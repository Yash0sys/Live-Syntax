# Quick Start Guide - Multi-File Live Syntax

## 🚀 Running the Application

### Step 1: Start the Server
```bash
cd server
npm install  # Only first time
npm start
```
Server will run on `http://localhost:5002`

### Step 2: Start the Client
```bash
cd client
npm install  # Only first time
npm start
```
Client will open at `http://localhost:3000`

## 🎯 Using the Multi-File System

### Creating Your First Project

1. **Create a folder structure:**
   - Click the **folder+** icon in the Explorer
   - Create folders: `src`, `components`, `styles`

2. **Create files:**
   - Click the **file+** icon or right-click a folder
   - Try creating:
     - `src/index.js` (JavaScript)
     - `src/main.py` (Python)
     - `components/Header.jsx` (React)
     - `styles/main.css` (CSS)
     - `README.md` (Markdown)

3. **Start coding:**
   - Click any file to open it
   - Notice the tab appears at the top
   - See automatic syntax highlighting!

### Example Project Structure
```
📁 root
├── 📁 src
│   ├── 📄 index.js
│   ├── 📄 app.js
│   └── 📄 utils.js
├── 📁 components
│   ├── 📄 Header.jsx
│   ├── 📄 Footer.jsx
│   └── 📄 Sidebar.jsx
├── 📁 styles
│   ├── 📄 main.css
│   └── 📄 components.css
└── 📄 README.md
```

## ✨ Key Features to Try

### 1. Multiple Files
- Open 5-6 different files
- See them all in tabs
- Switch between them
- Close tabs you don't need

### 2. Real-Time Collaboration
- Open the app in 2 browser windows
- Join the same room
- Create a file in one window
- See it instantly appear in the other!
- Edit files simultaneously

### 3. Language Support
Create these files to see syntax highlighting:

**JavaScript**
```javascript
// test.js
function greet(name) {
  console.log(`Hello, ${name}!`);
}
```

**Python**
```python
# calculator.py
def add(a, b):
    return a + b

print(add(5, 3))
```

**Java**
```java
// Main.java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

**C++**
```cpp
// hello.cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Hello World";
    return 0;
}
```

**HTML/CSS**
```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>My Website</h1>
</body>
</html>
```

```css
/* style.css */
body {
    font-family: Arial, sans-serif;
    background: #1e1e1e;
    color: white;
}
```

### 4. File Operations
- **Rename**: Right-click file → Rename → Enter new name
- **Delete**: Right-click file → Delete → Confirm
- **Organize**: Create folders to organize your code

### 5. Run Code
- Select language from dropdown (Python, Java, C++, C)
- Write code in active file
- Click "Open Compiler"
- Add input if needed
- Click "Run Code"
- See output!

### 6. AI Assistant
- Type a question: "What's wrong with this code?"
- Or: "Explain this function"
- Or: "Fix the syntax errors"
- Get instant help!

## 🎨 UI Guide

### Left Sidebar
- **Top Section**: Connected users with avatars
- **Middle Section**: File Explorer (tree view)
  - Click **+file** to create files
  - Click **+folder** to create folders
  - Right-click items for more options
- **Bottom Section**: Call controls, Room ID, Leave button

### Center Panel
- **Tab Bar**: All open files (click to switch)
- **Editor**: Your code with syntax highlighting
- **Status Bar**: Shows current file path

### Right Sidebar
- **AI Assistant**: Ask questions about your code
- Get explanations and fixes

## 🤝 Collaboration Features

### Multi-User Editing
- Each user has a colored cursor
- See other users' names above their cursors
- See their selections highlighted
- Everyone can create/delete files
- Changes sync instantly

### Voice Call (Built-in)
- Click "Join Call" to start voice chat
- Mute/Unmute your microphone
- Code and talk simultaneously!

## 🛠️ Troubleshooting

### Files not appearing?
- Make sure both server and client are running
- Check browser console for errors
- Refresh the page

### Syntax highlighting not working?
- Make sure file has the correct extension (.js, .py, .java, etc.)
- The editor auto-detects language from extension

### Can't delete a file?
- Only files and folders you create can be deleted
- Confirm the delete action in the popup

### Changes not syncing?
- Check if all users are in the same room
- Verify server is running and connected
- Check for network errors in console

## 📝 Pro Tips

1. **Organize Your Code**: Create logical folder structures (src, components, utils, styles)
2. **Use Extensions**: Always add file extensions (.js, .py, .css) for proper highlighting
3. **Tab Management**: Close unused tabs to keep workspace clean
4. **Right-Click**: Most file operations are in the right-click menu
5. **Collaborate**: Assign different files to different team members
6. **Voice Chat**: Use the built-in call feature for pair programming

## 🎯 Example Use Cases

### Frontend Project
```
📁 project
├── 📄 index.html
├── 📁 css
│   ├── 📄 style.css
│   └── 📄 responsive.css
├── 📁 js
│   ├── 📄 app.js
│   └── 📄 utils.js
└── 📁 images
```

### Full-Stack Project
```
📁 project
├── 📁 client
│   ├── 📄 index.html
│   ├── 📄 app.js
│   └── 📄 style.css
├── 📁 server
│   ├── 📄 index.js
│   ├── 📄 routes.js
│   └── 📄 database.js
└── 📄 README.md
```

### Python Project
```
📁 project
├── 📄 main.py
├── 📁 modules
│   ├── 📄 utils.py
│   └── 📄 config.py
├── 📁 tests
│   └── 📄 test_main.py
└── 📄 requirements.txt
```

## 🎉 Have Fun!

You now have a fully functional VS Code-like collaborative editor. Build amazing projects with your team in real-time!

**Questions or Issues?**
Check the main README.md or the MULTI_FILE_SYSTEM.md for detailed technical information.
