// Content script to monitor clipboard events
let lastClipboardContent = '';
let lastClipboardCheck = Date.now();

// Check if chrome runtime is available
function isChromeRuntimeAvailable() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
}

console.log('✅ forgor content script loaded');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_IMAGE') {
    // Fetch and compress image, then send to background
    fetch(message.imageUrl)
      .then(response => response.blob())
      .then(blob => {
        console.log('🖼️ Fetched image from context menu:', message.imageUrl.substring(0, 100));
        return compressImage(blob, 0, 0);
      })
      .then(compressedDataUrl => {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_IMAGE',
          content: {
            src: compressedDataUrl,
            alt: 'Image from context menu',
            width: 0,
            height: 0
          },
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        });
        console.log('✅ Image from context menu sent (compressed)');
      })
      .catch(error => {
        console.error('❌ Failed to fetch image from context menu:', error);
      });
  }
  return true;
});

// Compress image to reduce storage usage
async function compressImage(blob, originalWidth, originalHeight) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      // Max dimensions for storage (reduces file size significantly)
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;

      let width = originalWidth || img.width;
      let height = originalHeight || img.height;

      // Calculate new dimensions maintaining aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      // Create canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with 0.7 quality (good balance of quality/size)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

      const originalSize = blob.size;
      const compressedSize = Math.round(compressedDataUrl.length * 0.75); // Rough estimate
      console.log(`🗜️ Compressed image: ${originalSize} → ${compressedSize} bytes (${Math.round(compressedSize/originalSize*100)}%)`);

      URL.revokeObjectURL(url);
      resolve(compressedDataUrl);
    };

    img.onerror = () => {
      console.error('❌ Failed to load image for compression');
      URL.revokeObjectURL(url);
      // Fallback: return original as data URL
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(blob);
    };

    img.src = url;
  });
}

// Monitor clipboard changes (for right-click copy actions)
let isMonitoring = false;
let skipClipboardChecks = 0; // Counter to skip checks after capturing image

function startClipboardMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;

  // Check clipboard every 500ms when window is focused
  setInterval(async () => {
    if (!document.hasFocus()) return;
    if (!isChromeRuntimeAvailable()) return;

    const timeSinceLastCheck = Date.now() - lastClipboardCheck;
    if (timeSinceLastCheck >= 5000) return; // Only check within 5 seconds of context menu

    // Skip checks if we just captured an image from context menu
    if (skipClipboardChecks > 0) {
      skipClipboardChecks--;
      console.log('⏭️ Skipping clipboard check (' + skipClipboardChecks + ' remaining)');
      return;
    }

    try {
      // Try to read all clipboard items (including images)
      const clipboardItems = await navigator.clipboard.read();

      console.log('🔍 Checking clipboard, found items:', clipboardItems.length);

      // Check if we should capture image from last context menu target
      if (lastContextMenuTarget && lastContextMenuTarget.tagName === 'IMG') {
        const imgSrc = lastContextMenuTarget.src;
        if (imgSrc && imgSrc !== lastClipboardContent) {
          console.log('🖼️ Capturing image from context menu target:', imgSrc.substring(0, 100));

          // Store image properties before async operations
          const imgAlt = lastContextMenuTarget.alt || 'Copied image';
          const imgWidth = lastContextMenuTarget.naturalWidth || 0;
          const imgHeight = lastContextMenuTarget.naturalHeight || 0;
          lastContextMenuTarget = null; // Clear immediately

          // Fetch and convert image to data URL with compression
          try {
            const response = await fetch(imgSrc);
            const blob = await response.blob();
            console.log('📦 Fetched image blob, size:', blob.size, 'bytes');

            // Compress image before storing
            compressImage(blob, imgWidth, imgHeight).then(compressedDataUrl => {
              lastClipboardContent = compressedDataUrl;

              chrome.runtime.sendMessage({
                type: 'CLIPBOARD_IMAGE',
                content: {
                  src: compressedDataUrl,
                  alt: imgAlt,
                  width: imgWidth,
                  height: imgHeight
                },
                url: window.location.href,
                title: document.title,
                timestamp: Date.now()
              });
              console.log('✅ Image from right-click context menu sent (compressed)');
            });

            // Skip next 10 clipboard checks (5 seconds) to avoid duplicates
            skipClipboardChecks = 10;
            return; // Done with this check
          } catch (err) {
            console.log('❌ Failed to fetch image:', err.message);
            lastClipboardContent = imgSrc; // Mark as processed even if failed
          }
        }
      }

      for (const item of clipboardItems) {
        console.log('📦 Clipboard item types:', JSON.stringify(item.types));

        // Check for image
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        console.log('🖼️ Image types found:', JSON.stringify(imageTypes));
        if (imageTypes.length > 0) {
          console.log('✅ Found image type:', imageTypes[0], 'Reading blob...');
          const blob = await item.getType(imageTypes[0]);
          console.log('📦 Blob size:', blob.size, 'bytes');

          // Compress image before storing
          const compressedDataUrl = await compressImage(blob, 0, 0);

          if (compressedDataUrl !== lastClipboardContent) {
            lastClipboardContent = compressedDataUrl;
            console.log('📋 Image change detected from clipboard');
            chrome.runtime.sendMessage({
              type: 'CLIPBOARD_IMAGE',
              content: {
                src: compressedDataUrl,
                alt: 'Copied image',
                width: 0,
                height: 0
              },
              url: window.location.href,
              title: document.title,
              timestamp: Date.now()
            });
            console.log('✅ Image from clipboard sent (compressed)');
          }
          return; // Found image, done
        }

        // Check for text
        if (item.types.includes('text/plain')) {
          const textBlob = await item.getType('text/plain');
          const text = await textBlob.text();

          if (text && text !== lastClipboardContent) {
            lastClipboardContent = text;
            const trimmedText = text.trim();
            console.log('📋 Text change detected from clipboard:', trimmedText.substring(0, 50));
            console.log('🔍 Full text (first 100 chars):', JSON.stringify(trimmedText.substring(0, 100)));

            // Check if it's a URL (more lenient pattern)
            const urlPattern = /^https?:\/\/.+/i;
            if (urlPattern.test(trimmedText)) {
              console.log('🔗 URL detected from clipboard (right-click copy link)');
              chrome.runtime.sendMessage({
                type: 'CLIPBOARD_LINK',
                content: {
                  url: trimmedText,
                  text: trimmedText,
                  linkTitle: ''
                },
                url: window.location.href,
                title: document.title,
                timestamp: Date.now()
              });
              console.log('✅ Link from right-click sent');
            } else {
              console.log('📝 Text detected from clipboard (right-click copy)');
              chrome.runtime.sendMessage({
                type: 'CLIPBOARD_COPY',
                content: trimmedText,
                url: window.location.href,
                title: document.title,
                timestamp: Date.now()
              });
              console.log('✅ Text from right-click sent');
            }
          } else if (text && text === lastClipboardContent) {
            console.log('⏭️ Skipping duplicate clipboard content:', text.substring(0, 30));
          }
        }
      }
    } catch (error) {
      // Clipboard read failed (expected if no permission)
      // Silently ignore - this is normal
    }
  }, 500);
}

// Start monitoring
startClipboardMonitoring();

// Listen for copy events (Ctrl+C)
document.addEventListener('copy', async (e) => {
  try {
    if (!isChromeRuntimeAvailable()) {
      console.warn('Chrome runtime not available on this page');
      return;
    }

    console.log('📋 Copy event detected (Ctrl+C)');
    lastClipboardCheck = Date.now(); // Reset timer

    // First priority: Check clipboard data for images
    const clipboardData = e.clipboardData;
    if (clipboardData && clipboardData.items) {
      // Check for image in clipboard
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          console.log('🖼️ Image found in clipboard (Ctrl+C)');
          const blob = item.getAsFile();

          // Compress image before storing
          compressImage(blob, 0, 0).then(compressedDataUrl => {
            lastClipboardContent = compressedDataUrl;
            chrome.runtime.sendMessage({
              type: 'CLIPBOARD_IMAGE',
              content: {
                src: compressedDataUrl,
                alt: 'Copied image',
                width: 0,
                height: 0
              },
              url: window.location.href,
              title: document.title,
              timestamp: Date.now()
            });
            console.log('✅ Image sent to background (compressed)');
          });

          return; // Done, stop here
        }
      }
    }

    // Second priority: Check for selected text
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      console.log('📝 Text selected:', selectedText.substring(0, 50) + '...');
      lastClipboardContent = selectedText; // Store to avoid duplicate

      // Check if selected HTML contains a link
      if (clipboardData) {
        const htmlData = clipboardData.getData('text/html');
        if (htmlData) {
          // Try to parse as HTML and find link
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlData;
          const link = tempDiv.querySelector('a');

          if (link && link.href) {
            console.log('🔗 Link found:', link.href);
            chrome.runtime.sendMessage({
              type: 'CLIPBOARD_LINK',
              content: {
                url: link.href,
                text: link.textContent || link.href,
                linkTitle: link.title || ''
              },
              url: window.location.href,
              title: document.title,
              timestamp: Date.now()
            });
            console.log('✅ Link sent to background');
            return; // Done
          }
        }
      }

      // Check if text itself is a URL (more lenient pattern)
      const urlPattern = /^https?:\/\/.+/i;
      console.log('🔍 Testing if selected text is URL:', selectedText.substring(0, 100));
      if (urlPattern.test(selectedText)) {
        console.log('🔗 URL detected in text');
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_LINK',
          content: {
            url: selectedText,
            text: selectedText,
            linkTitle: ''
          },
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        });
        console.log('✅ URL as link sent to background');
        return; // Done
      }

      // Default: send as text
      console.log('📤 Sending as text');
      chrome.runtime.sendMessage({
        type: 'CLIPBOARD_COPY',
        content: selectedText,
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
      });
      console.log('✅ Text sent to background');
      return;
    }

    console.log('⚠️ No content detected in copy event');

  } catch (error) {
    console.error('❌ Error in copy handler:', error);
  }
});

// Listen for context menu being opened (user might copy)
let contextMenuCount = 0;
let lastContextMenuTarget = null;
document.addEventListener('contextmenu', (e) => {
  contextMenuCount++;
  lastClipboardCheck = Date.now();
  lastContextMenuTarget = e.target;

  // Check if user right-clicked on an image
  if (e.target && e.target.tagName === 'IMG') {
    console.log(`🖱️ Context menu opened on IMAGE (${contextMenuCount}):`, e.target.src);
  } else {
    console.log(`🖱️ Context menu opened (${contextMenuCount}) on:`, e.target.tagName);
  }
});

// Listen for cut events
document.addEventListener('cut', async (e) => {
  try {
    if (!isChromeRuntimeAvailable()) {
      return;
    }

    console.log('✂️ Cut event detected');
    lastClipboardCheck = Date.now();

    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      lastClipboardContent = selectedText;

      // Check if URL (more lenient pattern)
      const urlPattern = /^https?:\/\/.+/i;
      if (urlPattern.test(selectedText)) {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_LINK',
          content: {
            url: selectedText,
            text: selectedText,
            linkTitle: ''
          },
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        });
      } else {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_COPY',
          content: selectedText,
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        });
      }
      console.log('✅ Cut content sent');
    }
  } catch (error) {
    console.error('Error in cut handler:', error);
  }
});

// Listen for paste events
document.addEventListener('paste', async (e) => {
  try {
    if (!isChromeRuntimeAvailable()) {
      return;
    }

    console.log('📌 Paste event detected');

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Check for images
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type.indexOf('image') !== -1) {
          console.log('🖼️ Pasted image detected');
          const blob = item.getAsFile();

          // Compress image before storing
          compressImage(blob, 0, 0).then(compressedDataUrl => {
            chrome.runtime.sendMessage({
              type: 'CLIPBOARD_IMAGE',
              content: {
                src: compressedDataUrl,
                alt: 'Pasted image',
                width: 0,
                height: 0
              },
              url: window.location.href,
              title: document.title,
              timestamp: Date.now()
            });
            console.log('✅ Pasted image sent (compressed)');
          });

          return;
        }
      }
    }

    // Check for text
    const pastedText = clipboardData.getData('text/plain');
    if (pastedText && pastedText.trim()) {
      if (pastedText === lastClipboardContent) return; // Avoid duplicates
      lastClipboardContent = pastedText;

      // Check if URL (more lenient pattern)
      const urlPattern = /^https?:\/\/.+/i;
      if (urlPattern.test(pastedText.trim())) {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_LINK',
          content: {
            url: pastedText.trim(),
            text: pastedText.trim(),
            linkTitle: ''
          },
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        });
      } else {
        chrome.runtime.sendMessage({
          type: 'CLIPBOARD_PASTE',
          content: pastedText.trim(),
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        });
      }
      console.log('✅ Pasted text sent');
    }
  } catch (error) {
    console.error('Error in paste handler:', error);
  }
});

console.log('🔍 Clipboard monitoring active');
