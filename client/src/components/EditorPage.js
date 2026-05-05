import React, { useEffect, useRef, useState } from "react";
import Client from "./Client";
import Editor from "./Editor";
import FileExplorer, { getLanguageFromFile } from "./FileExplorer";
import FileTabs from "./FileTabs";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";
import WebRTCManager from "../WebRTCManager";

// List of supported languages
const LANGUAGES = [
  "python3",
  "java",
  "cpp",
  "c",
];

// Initial file structure
const getInitialFileStructure = () => ({
  name: "root",
  type: "folder",
  children: {
    "index.js": {
      name: "index.js",
      type: "file",
      content: "// Welcome to Live Syntax!\n// Create files and folders to build your project\n",
    },
  },
});

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCompileWindowOpen, setIsCompileWindowOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("python3");
  const [programInput, setProgramInput] = useState("");
  const [joinRequests, setJoinRequests] = useState([]);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // File system state
  const [fileStructure, setFileStructure] = useState(getInitialFileStructure());
  const [openFiles, setOpenFiles] = useState(["/root/index.js"]);
  const [activeFile, setActiveFile] = useState("/root/index.js");
  const [fileContents, setFileContents] = useState({
    "/root/index.js": "// Welcome to Live Syntax!\n// Create files and folders to build your project\n",
  });

  const codeRef = useRef(null);

  // Safeguard: Save current file content before switching
  useEffect(() => {
    // When activeFile changes, ensure we save the content from codeRef
    return () => {
      if (codeRef.current !== null && activeFile) {
        setFileContents((prevContents) => ({
          ...prevContents,
          [activeFile]: codeRef.current,
        }));
        console.log("Cleanup save:", { activeFile, code: codeRef.current?.substring(0, 30) });
      }
    };
  }, [activeFile]);

  // Panel resize state
  const [leftPanelWidth, setLeftPanelWidth] = useState(20); // percentage
  const [rightPanelWidth, setRightPanelWidth] = useState(20); // percentage
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const containerRef = useRef(null);

  const Location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  const socketRef = useRef(null);
  const webrtcManagerRef = useRef(null);

  // Ensure active file is initialized in fileContents when tab switching
  useEffect(() => {
    if (activeFile && !fileContents[activeFile]) {
      setFileContents((prevContents) => ({
        ...prevContents,
        [activeFile]: "",
      }));
    }
  }, [activeFile]);

  useEffect(() => {
    const init = async () => {
      const handleErrors = (err) => {
        console.log("Error", err);
        toast.error("Socket connection failed, Try again later");
        navigate("/");
      };

      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: Location.state?.username,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          // When we successfully join, hide waiting screen
          setIsWaitingForApproval(false);
          
          if (username !== Location.state?.username) {
            toast.success(`${username} joined the room.`);
          }
          setClients(clients);
          
          // Sync file structure to new user
          socketRef.current.emit(ACTIONS.FILE_STRUCTURE_SYNC, {
            fileStructure,
            fileContents,
            socketId,
          });
        }
      );

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });

      // Handle join requests (for host only)
      socketRef.current.on(ACTIONS.JOIN_REQUEST, ({ socketId, username }) => {
        setJoinRequests((prev) => [...prev, { socketId, username }]);
      });

      // Handle waiting for approval (for non-host users)
      socketRef.current.on(ACTIONS.WAITING_FOR_APPROVAL, () => {
        setIsWaitingForApproval(true);
      });

      // Handle rejection (for users trying to join)
      socketRef.current.on(ACTIONS.JOIN_REJECTED, () => {
        toast.error("The host rejected your request to join the room");
        navigate("/");
      });

      // Handle host change (when current host leaves)
      socketRef.current.on(ACTIONS.HOST_CHANGED, ({ newHostSocketId, newHostUsername, clients }) => {
        setClients(clients);
        if (newHostSocketId === socketRef.current.id) {
          toast.success("You are now the host!");
        } else {
          toast.success(`${newHostUsername} is now the host`);
        }
      });

      // Handle file structure sync
      socketRef.current.on(ACTIONS.FILE_STRUCTURE_UPDATE, ({ fileStructure: newStructure, fileContents: newContents }) => {
        console.log("📥 FILE_STRUCTURE_UPDATE received:", { 
          files: Object.keys(newContents || {}),
          newContents: newContents
        });
        if (newStructure) {
          console.log("📁 Setting fileStructure:", newStructure);
          setFileStructure(newStructure);
        }
        if (newContents) {
          // ⚠️ IMPORTANT: REPLACE fileContents completely with MongoDB data only
          // Do NOT merge - this ensures we only show what's in MongoDB, no stale cached data
          console.log("💾 FileContents REPLACED with MongoDB data:", { 
            incomingFiles: Object.keys(newContents),
            newContents: newContents
          });
          setFileContents(newContents);
        }
      });

      // Handle code changes from other users
      // ⚠️ IMPORTANT: Do NOT update fileContents here!
      // MongoDB (via FILE_STRUCTURE_UPDATE) is the source of truth
      // CodeMirror shows real-time typing, fileContents is only for file persistence
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code, filePath }) => {
        console.log("📨 CODE_CHANGE received from server:", { filePath, codeLength: code?.length });
        // Content is already shown in real-time by CodeMirror
        // Persistence is handled by FILE_STRUCTURE_UPDATE from MongoDB
      });
    };
    init();

    return () => {
      // Cleanup WebRTC before disconnecting socket
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.cleanup();
      }
      
      socketRef.current && socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.off(ACTIONS.JOIN_REQUEST);
      socketRef.current.off(ACTIONS.JOIN_REJECTED);
      socketRef.current.off(ACTIONS.WAITING_FOR_APPROVAL);
      socketRef.current.off(ACTIONS.HOST_CHANGED);
      socketRef.current.off(ACTIONS.FILE_STRUCTURE_UPDATE);
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, []);

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;

      if (isResizingLeft) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth = Math.max(15, Math.min(50, (e.clientX / containerRect.width) * 100));
        setLeftPanelWidth(newLeftWidth);
      } else if (isResizingRight) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newRightWidth = Math.max(15, Math.min(50, ((containerRect.width - e.clientX) / containerRect.width) * 100));
        setRightPanelWidth(newRightWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingLeft, isResizingRight]);

  if (!Location.state) {
    return <Navigate to="/" />;
  }

  // Show waiting screen if user is pending approval
  if (isWaitingForApproval) {
    return (
      <div className="container-fluid vh-100 d-flex justify-content-center align-items-center bg-dark">
        <div className="text-center text-light">
          <div className="spinner-border text-primary mb-4" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h3>Waiting for host approval...</h3>
          <p className="text-muted">The host will review your request to join the room</p>
          <button className="btn btn-outline-danger mt-3" onClick={() => navigate("/")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`Room ID is copied`);
    } catch (error) {
      console.log(error);
      toast.error("Unable to copy the room ID");
    }
  };

  const leaveRoom = async () => {
    navigate("/");
  };

  // File system helper functions
  const setItemAtPath = (structure, path, item) => {
    const parts = path.split('/').filter(p => p && p !== 'root');
    let current = structure;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current.children[parts[i]]) {
        current.children[parts[i]] = { name: parts[i], type: 'folder', children: {} };
      }
      current = current.children[parts[i]];
    }
    
    const lastName = parts[parts.length - 1];
    current.children[lastName] = item;
    return { ...structure };
  };

  const deleteItemAtPath = (structure, path) => {
    const parts = path.split('/').filter(p => p && p !== 'root');
    let current = structure;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current = current.children[parts[i]];
    }
    
    const lastName = parts[parts.length - 1];
    delete current.children[lastName];
    return { ...structure };
  };

  const handleFileSelect = (path, content) => {
    setActiveFile(path);
    if (!openFiles.includes(path)) {
      setOpenFiles([...openFiles, path]);
    }
    if (!fileContents[path]) {
      setFileContents({ ...fileContents, [path]: content || "" });
    }
  };

  const handleTabSelect = (path) => {
    console.log("🔄 Switching to file:", { path, hasContent: !!fileContents[path], contentLength: fileContents[path]?.length || 0 });
    
    // CRITICAL: Save current file content BEFORE switching
    if (activeFile && codeRef.current !== null) {
      setFileContents((prevContents) => {
        const updated = { ...prevContents, [activeFile]: codeRef.current };
        console.log("💾 SAVED current file before switching:", { activeFile, contentLength: codeRef.current?.length });
        return updated;
      });
    }
    
    // Ensure new file is initialized in fileContents before switching tab
    setFileContents((prevContents) => {
      const updated = { ...prevContents };
      if (!updated[path]) {
        console.log("📌 File not in fileContents, initializing with empty string:", { path });
        updated[path] = "";
      }
      console.log("📌 Ready to load file:", { path, keysCount: Object.keys(updated).length });
      return updated;
    });
    
    // Switch to the file tab
    setActiveFile(path);
  };

  const handleCloseFile = (path) => {
    // Save this file's content before closing it
    if (codeRef.current !== null && path === activeFile) {
      setFileContents((prevContents) => ({
        ...prevContents,
        [path]: codeRef.current,
      }));
      console.log("💾 SAVED file before closing:", { path });
    }
    
    const newOpenFiles = openFiles.filter(f => f !== path);
    setOpenFiles(newOpenFiles);
    
    if (activeFile === path && newOpenFiles.length > 0) {
      setActiveFile(newOpenFiles[newOpenFiles.length - 1]);
    }
  };

  const handleCreateFile = (path) => {
    const fileName = path.split('/').pop();
    const newStructure = setItemAtPath(fileStructure, path, {
      name: fileName,
      type: 'file',
      content: '',
    });
    
    setFileStructure(newStructure);
    setFileContents({ ...fileContents, [path]: '' });
    setOpenFiles([...openFiles, path]);
    setActiveFile(path);
    
    // Broadcast to all users
    socketRef.current.emit(ACTIONS.FILE_CREATE, {
      roomId,
      path,
      fileName,
    });
  };

  const handleCreateFolder = (path) => {
    const folderName = path.split('/').pop();
    const newStructure = setItemAtPath(fileStructure, path, {
      name: folderName,
      type: 'folder',
      children: {},
    });
    
    setFileStructure(newStructure);
    
    // Broadcast to all users
    socketRef.current.emit(ACTIONS.FOLDER_CREATE, {
      roomId,
      path,
      folderName,
    });
  };

  const handleDeleteItem = (path) => {
    const newStructure = deleteItemAtPath(fileStructure, path);
    setFileStructure(newStructure);
    
    // Close file if open
    if (openFiles.includes(path)) {
      handleCloseFile(path);
    }
    
    // Remove from fileContents
    const newContents = { ...fileContents };
    delete newContents[path];
    setFileContents(newContents);
    
    // Broadcast to all users
    socketRef.current.emit(ACTIONS.FILE_DELETE, {
      roomId,
      path,
    });
  };

  const handleRenameItem = (oldPath, newPath) => {
    // Get item at old path
    const parts = oldPath.split('/').filter(p => p && p !== 'root');
    let current = fileStructure;
    
    for (let i = 0; i < parts.length - 1; i++) {
      current = current.children[parts[i]];
    }
    
    const item = current.children[parts[parts.length - 1]];
    
    // Update name
    const newName = newPath.split('/').pop();
    const updatedItem = { ...item, name: newName };
    
    // Delete old and add new
    let newStructure = deleteItemAtPath(fileStructure, oldPath);
    newStructure = setItemAtPath(newStructure, newPath, updatedItem);
    setFileStructure(newStructure);
    
    // Update open files
    if (openFiles.includes(oldPath)) {
      setOpenFiles(openFiles.map(f => f === oldPath ? newPath : f));
    }
    
    // Update active file
    if (activeFile === oldPath) {
      setActiveFile(newPath);
    }
    
    // Update file contents
    if (fileContents[oldPath]) {
      const newContents = { ...fileContents };
      newContents[newPath] = newContents[oldPath];
      delete newContents[oldPath];
      setFileContents(newContents);
    }
    
    // Broadcast to all users
    socketRef.current.emit(ACTIONS.FILE_RENAME, {
      roomId,
      oldPath,
      newPath,
    });
  };

  const handleCodeChange = (code, filePath = activeFile) => {
    codeRef.current = code;
    // Validate filePath before updating
    if (!filePath) {
      console.warn("❌ handleCodeChange: filePath is empty, skipping update", { code: code?.substring(0, 30) });
      return;
    }
    console.log("✍️ handleCodeChange called:", { filePath, codeLength: code?.length });
    
    // Update fileContents for ACTIVE file only (so user sees their edits while typing)
    // This file's content will be confirmed by MongoDB via FILE_STRUCTURE_UPDATE
    setFileContents((prevContents) => {
      const updated = { ...prevContents, [filePath]: code };
      return updated;
    });
    
    // Emit CODE_CHANGE to server (and it will broadcast to others)
    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      code,
      filePath,
    });
  };

  const handleApproveJoin = (socketId, username) => {
    socketRef.current.emit(ACTIONS.APPROVE_JOIN, { socketId, roomId });
    setJoinRequests((prev) => prev.filter((req) => req.socketId !== socketId));
    toast.success(`${username} has been approved to join`);
  };

  const handleRejectJoin = (socketId, username) => {
    socketRef.current.emit(ACTIONS.REJECT_JOIN, { socketId, roomId });
    setJoinRequests((prev) => prev.filter((req) => req.socketId !== socketId));
    toast.success(`${username}'s request has been rejected`);
  };

  const runCode = async () => {
    setIsCompiling(true);
    try {
      // Get the code from the active file
      const currentCode = fileContents[activeFile] || "";
      
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/compile`, {
        code: currentCode,
        language: selectedLanguage,
        input: programInput, // Include program input
      });
      console.log("Backend response:", response.data);
      setOutput(response.data.output || JSON.stringify(response.data));
    } catch (error) {
      console.error("Error compiling code:", error);
      setOutput(error.response?.data?.error || "An error occurred");
    } finally {
      setIsCompiling(false);
    }
  };

  const sendAiPrompt = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiResponse("");
    try {
      // Get the code from the active file
      const currentCode = fileContents[activeFile] || "";
      const fileExtension = activeFile ? activeFile.split('.').pop() : 'js';
      
      const response = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/ai`, {
        prompt: aiPrompt,
        code: currentCode,
        language: fileExtension,
      });
      setAiResponse(response.data.reply || JSON.stringify(response.data));
    } catch (err) {
      console.error("AI error", err);
      const errorDetails = err.response?.data?.details || err.response?.data?.error || err.message;
      setAiResponse(`Error: ${errorDetails}\n\nPlease check:\n1. Your Groq API key is valid (get free at https://console.groq.com)\n2. The key is added to server/.env\n3. The server is running`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleCompileWindow = () => {
    setIsCompileWindowOpen(!isCompileWindowOpen);
  };

  // Voice call handlers
  const handleJoinCall = async () => {
    try {
      // Always create a fresh WebRTCManager instance to avoid stale state
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.cleanup();
      }
      
      webrtcManagerRef.current = new WebRTCManager(
        socketRef,
        roomId,
        Location.state?.username
      );

      await webrtcManagerRef.current.joinCall(clients);
      setIsInCall(true);
      toast.success("Joined voice call");
    } catch (error) {
      console.error("Error joining call:", error);
      toast.error(error.message || "Failed to join call");
    }
  };

  const handleLeaveCall = () => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.leaveCall();
      setIsInCall(false);
      setIsMuted(false);
      toast.success("Left voice call");
    }
  };

  const handleToggleMute = () => {
    if (webrtcManagerRef.current) {
      const muted = webrtcManagerRef.current.toggleMute();
      setIsMuted(muted);
      toast.success(muted ? "Microphone muted" : "Microphone unmuted");
    }
  };

  const handleSaveProject = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/save-project`,
        {
          roomId,
          fileStructure,
          fileContents,
          projectName: `Project-${roomId.slice(0, 8)}`,
        }
      );
      toast.success("Project saved successfully!");
      console.log("Project saved:", response.data);
    } catch (err) {
      console.error("Error saving project:", err);
      toast.error(err.response?.data?.error || "Failed to save project");
    }
  };

  return (
    <div className="container-fluid vh-100 d-flex flex-column" ref={containerRef}>
      {/* Join Requests Modal/Notification */}
      {joinRequests.length > 0 && (
        <div
          className="position-fixed top-0 start-50 translate-middle-x mt-3"
          style={{ zIndex: 2000, maxWidth: "500px", width: "90%" }}
        >
          <div className="card bg-dark border-primary shadow-lg">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <i className="bi bi-bell-fill me-2"></i>
                Join Requests ({joinRequests.length})
              </h6>
            </div>
            <div className="card-body p-2" style={{ maxHeight: "300px", overflowY: "auto" }}>
              {joinRequests.map((request, index) => (
                <div
                  key={request.socketId}
                  className={`d-flex justify-content-between align-items-center p-3 ${
                    index !== joinRequests.length - 1 ? "border-bottom border-secondary" : ""
                  }`}
                  style={{ backgroundColor: "#1a1d29" }}
                >
                  <div className="text-light">
                    <strong className="fs-6">{request.username}</strong>
                    <small className="d-block text-muted">wants to join the room</small>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-success btn-sm px-3"
                      onClick={() => handleApproveJoin(request.socketId, request.username)}
                      title="Approve"
                    >
                      <i className="bi bi-check-lg"></i> Allow
                    </button>
                    <button
                      className="btn btn-danger btn-sm px-3"
                      onClick={() => handleRejectJoin(request.socketId, request.username)}
                      title="Reject"
                    >
                      <i className="bi bi-x-lg"></i> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexGrow: 1 }}>
        {/* Left Panel - Members & Explorer */}
        <div 
          style={{ 
            width: `${leftPanelWidth}%`,
            backgroundColor: '#1a1d29',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '200px',
            overflow: 'hidden'
          }}
        >
          <img
            src="/images/LiveSyntaxRectangle.png"
            alt="Live Syntax Logo"
            className="img-fluid mx-auto d-block my-3"
            style={{ maxWidth: "140px" }}
          />
          <hr />

          {/* Client list container - Fixed height with scroll */}
          <div style={{ maxHeight: '200px', minHeight: '100px', overflow: 'auto' }}>
            <span className="mb-2 d-block">Members</span>
            {clients.map((client) => (
              <Client 
                key={client.socketId} 
                username={client.username} 
                isHost={client.isHost}
                inCall={client.socketId === socketRef.current?.id && isInCall}
              />
            ))}
          </div>

          <hr />
          
          {/* File Explorer - Takes remaining space */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <FileExplorer
              fileStructure={fileStructure}
              onFileSelect={handleFileSelect}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onDeleteItem={handleDeleteItem}
              onRenameItem={handleRenameItem}
            />
          </div>

          <hr />
          {/* Buttons */}
          <div style={{ marginTop: 'auto', marginBottom: '1rem' }}>
            {/* Voice call controls */}
            {!isInCall ? (
              <button 
                className="btn btn-outline-primary w-100 mb-2" 
                onClick={handleJoinCall}
                title="Join voice call with room members"
              >
                <i className="bi bi-telephone-fill me-2"></i>
                Join Call
              </button>
            ) : (
              <div className="mb-2">
                <button 
                  className="btn btn-danger w-100 mb-2" 
                  onClick={handleLeaveCall}
                  title="Leave voice call"
                >
                  <i className="bi bi-telephone-x-fill me-2"></i>
                  Leave Call
                </button>
                <button 
                  className={`btn ${isMuted ? 'btn-warning' : 'btn-outline-secondary'} w-100`}
                  onClick={handleToggleMute}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  <i className={`bi ${isMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'} me-2`}></i>
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
            )}
            
            <button className="btn btn-outline-info w-100 mb-2" onClick={handleSaveProject}>
              <i className="bi bi-cloud-arrow-up me-2"></i>
              Save Project
            </button>
            <button className="btn btn-outline-success w-100 mb-2" onClick={copyRoomId}>
              Copy Room ID
            </button>
            <button className="btn btn-outline-danger w-100" onClick={leaveRoom}>
              Leave Room
            </button>
          </div>
        </div>

        {/* Left Resize Handle */}
        <div
          onMouseDown={() => setIsResizingLeft(true)}
          style={{
            width: '5px',
            backgroundColor: isResizingLeft ? '#0d6efd' : '#495057',
            cursor: 'col-resize',
            transition: isResizingLeft ? 'none' : 'background-color 0.2s',
            userSelect: 'none',
          }}
          title="Drag to resize"
        />

        {/* Middle Panel - Editor */}
        <div 
          style={{ 
            flex: 1,
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden'
          }}
        >
          {/* File Tabs */}
          <FileTabs
            openFiles={openFiles}
            activeFile={activeFile}
            onSelectFile={handleTabSelect}
            onCloseFile={handleCloseFile}
          />

          {/* Language selector */}
          <div className="bg-dark p-2 d-flex justify-content-between align-items-center border-bottom border-secondary">
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              {activeFile && <><i className="bi bi-file-earmark-code me-2"></i>{activeFile}</>}
            </span>
            <select
              className="form-select w-auto"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <Editor
            socketRef={socketRef}
            roomId={roomId}
            onCodeChange={handleCodeChange}
            activeFile={activeFile}
            fileContent={fileContents[activeFile] || ""}
            language={activeFile ? getLanguageFromFile(activeFile) : "javascript"}
          />
        </div>

        {/* Right Resize Handle */}
        <div
          onMouseDown={() => setIsResizingRight(true)}
          style={{
            width: '5px',
            backgroundColor: isResizingRight ? '#0d6efd' : '#495057',
            cursor: 'col-resize',
            transition: isResizingRight ? 'none' : 'background-color 0.2s',
            userSelect: 'none',
          }}
          title="Drag to resize"
        />

        {/* Right Panel - AI Assistant */}
        <div 
          style={{ 
            width: `${rightPanelWidth}%`,
            backgroundColor: '#1a1d29',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            minWidth: '200px',
            overflow: 'hidden',
            borderLeft: '1px solid #495057'
          }}
        >
          <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ marginBottom: '1rem' }}>
              <h5 style={{ color: 'white', marginBottom: '0.25rem', display: 'flex', alignItems: 'center' }}>
                <i className="bi bi-robot me-2" style={{ fontSize: '1.3rem' }}></i>
                AI Assistant
              </h5>
              <small style={{ color: '#adb5bd', fontSize: '0.8rem' }}>
                Get help with debugging, syntax, and code suggestions
              </small>
            </div>

            {/* Prompt Input */}
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                className="form-control bg-secondary text-light border-0 shadow-sm"
                rows={5}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., What's the error here? Fix this code. Explain this function..."
                style={{ 
                  resize: 'none',
                  fontSize: '0.9rem',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button 
                className="btn btn-primary flex-grow-1" 
                onClick={sendAiPrompt} 
                disabled={isAiLoading || !aiPrompt.trim()}
                style={{ fontWeight: '500' }}
              >
                {isAiLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Thinking...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>Ask AI
                  </>
                )}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setAiPrompt(''); setAiResponse(''); }}
                title="Clear conversation"
                style={{ minWidth: '80px' }}
              >
                Clear
              </button>
            </div>

            {/* Response Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: '80px' }}>
              <h6 style={{ color: 'white', marginBottom: '0.5rem', display: 'flex', alignItems: 'center' }}>
                <i className="bi bi-chat-left-dots me-2"></i>Response
              </h6>
              <div 
                style={{ 
                  flex: 1,
                  backgroundColor: 'black',
                  color: 'white',
                  padding: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #495057',
                  overflowY: 'auto',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  marginBottom: '10px'
                }}
              >
                {isAiLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adb5bd' }}>
                    <div className="spinner-border spinner-border-sm mb-2" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p style={{ marginBottom: 0 }}>Analyzing your request...</p>
                  </div>
                ) : aiResponse ? (
                  <pre style={{ marginBottom: 0, color: 'white', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                    {aiResponse}
                  </pre>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adb5bd' }}>
                    <i className="bi bi-lightbulb" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                    <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.85rem' }}>
                      Ask me anything about your code!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compiler toggle button */}
      <button
        className="btn btn-outline-info position-fixed bottom-0 end-0 m-3"
        onClick={toggleCompileWindow}
        style={{ zIndex: 1050 }}
      >
        {isCompileWindowOpen ? "Close Compiler" : "Open Compiler"}
      </button>

      {/* Compiler section */}
      <div
        className={`bg-dark text-light p-3 ${
          isCompileWindowOpen ? "d-block" : "d-none"
        }`}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: isCompileWindowOpen ? "30vh" : "0",
          transition: "height 0.3s ease-in-out",
          overflowY: "auto",
          zIndex: 1040,
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0">Compiler Output ({selectedLanguage})</h5>
          <div>
            <button
              className="btn btn-success me-2"
              onClick={runCode}
              disabled={isCompiling}
            >
              {isCompiling ? "Compiling..." : "Run Code"}
            </button>
            <button className="btn btn-secondary" onClick={toggleCompileWindow}>
              Close
            </button>
          </div>
        </div>

        {/* Program Input Section */}
        <div className="mb-3">
          <label className="form-label">
            <strong>Program Input:</strong> 
            <small className="text-muted ms-2">
              (For programs that require user input like cin, scanf, input(), etc.)
            </small>
          </label>
          <textarea
            className="form-control bg-dark text-light"
            rows="3"
            placeholder={`Enter input for your ${selectedLanguage} program here... `}
            value={programInput}
            onChange={(e) => setProgramInput(e.target.value)}
            style={{ 
              border: '1px solid #6c757d',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}
          />
        </div>

        {/* Output Section */}
        <div>
          <label className="form-label"><strong>Output:</strong></label>
          <pre className="bg-secondary p-3 rounded" style={{ minHeight: '100px' }}>
            {output || "Output will appear here after compilation"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default EditorPage;
