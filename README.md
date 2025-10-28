# forgor 🗂️

> Never forget what you copied - A smart, tab-based clipboard manager for Chrome

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-d1f7ff?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/license-MIT-d1f7ff.svg)](LICENSE)

**forgor** is a lightweight, intelligent clipboard manager that organizes your clipboard history by browser tabs. Each tab maintains its own separate clipboard history with customizable retention policies, making it easy to manage and recall what you've copied across different contexts.

---

## ✨ Features

### 🎯 Core Functionality
- **Tab-Based Organization** - Each Chrome tab has its own clipboard history
- **Multi-Format Support** - Save text, links, and images automatically
- **Smart Detection** - Automatically identifies and categorizes content types
- **Image Compression** - Reduces storage usage while maintaining quality (max 800x800px, 70% quality)

### 🎨 Clipboard Management
- **Pin Important Items** - Keep frequently used items at the top
- **Quick Copy** - Click any item to copy it back to clipboard
- **Real-Time Updates** - Popup refreshes automatically when new content is saved
- **Search & Filter** - Easily find what you need

### ⚙️ Customization
- **Retention Policies** - Configure per-tab retention by count or time
  - Count-based: Keep last N items (1-1000)
  - Time-based: Keep items for N minutes/hours
- **Per-Tab Toggle** - Enable/disable clipboard saving for specific tabs
- **Global Settings** - Master switch for auto-capture
- **Context Menu Integration** - Right-click to manually add links and images

### 🔒 Privacy
- **100% Local Storage** - All data stored locally on your device
- **No Tracking** - Zero analytics, no data collection
- **No Permissions Abuse** - Only essential permissions requested
- **Tab Cleanup** - History automatically deleted when tabs close

---

## 🚀 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) *(link coming soon)*
2. Click "Add to Chrome"
3. Confirm the installation

### Manual Installation (Developer Mode)
1. Download or clone this repository
   ```bash
   git clone https://github.com/yourusername/forgor.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `chrome-extension` folder
6. The forgor icon will appear in your extensions toolbar

---

## 📖 How to Use

### Automatic Capture
forgor automatically captures clipboard content as you work:
- **Text** - Copy any text with `Ctrl+C` or `Cmd+C`
- **Links** - Copy link text or use "Copy link address"
- **Images** - Right-click images and select "Copy image"

### Manual Addition
Right-click on any link or image and select **"Add to forgor"** from the context menu.

### Managing Your Clipboard
1. **Click the forgor icon** to open the popup
2. **View tab history** - See all items copied in the current tab
3. **Click any item** to copy it back to your clipboard
4. **Pin items** - Click the pin icon to keep items at the top
5. **Delete items** - Click the trash icon to remove

### Configuring Settings

#### Per-Tab Settings
1. Click the **tune icon** (⚙️) next to the tab name
2. Choose retention type:
   - **By Count**: Keep last N items (default: 50)
   - **By Time**: Keep items for N minutes/hours (default: 60 minutes)
3. Click **Save**

#### Global Settings
1. Click the **settings icon** in the top-right
2. Toggle **Enable Auto Capture** on/off
3. View and manage all tabs

#### Tab Toggle
Use the toggle switch next to the tab name to quickly enable/disable clipboard saving for that specific tab.

---

## 💖 Support

If you find forgor useful, consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-d1f7ff?style=for-the-badge&logo=buy-me-a-coffee&logoColor=000000)](https://buymeacoffee.com/nghialxx)

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">Made with 💙 by nghialxx</p>
<p align="center">
  <a href="#forgor-️">Back to top ↑</a>
</p>
