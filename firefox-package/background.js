// Background service worker for Chrome extension
// Organizes clipboard by Chrome tab ID

// Initialize storage and context menus
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['clips', 'tabSettings', 'settings']);

  if (!data.clips) {
    await chrome.storage.local.set({
      clips: {}, // Format: { tabId: [clips] }
      tabSettings: {}, // Format: { tabId: { retentionType, maxCount, retentionPeriod, retentionUnit } }
      settings: {
        autoCapture: true
      }
    });
  }

  // Create context menu items
  // Note: Not adding selection context because auto-capture already handles text
  // This also prevents duplicate menus when right-clicking links

  chrome.contextMenus.create({
    id: 'add-link-to-forgor',
    title: 'Add to forgor',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'add-image-to-forgor',
    title: 'Add to forgor',
    contexts: ['image']
  });

  console.log('Context menus created');
});

// Listen for clipboard events from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLIPBOARD_COPY' || message.type === 'CLIPBOARD_PASTE' ||
      message.type === 'CLIPBOARD_IMAGE' || message.type === 'CLIPBOARD_LINK') {
    handleClipboardSave(message, sender.tab);
  }
  return true;
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, 'on tab:', tab.id);

  // Check if tab is enabled
  const storage = await chrome.storage.local.get(['tabEnabledStates', 'settings']);
  const tabId = tab.id.toString();
  const tabEnabledStates = storage.tabEnabledStates || {};
  const isTabEnabled = tabEnabledStates[tabId] !== false;

  if (!isTabEnabled) {
    console.log('Context menu action blocked - tab is disabled');
    return;
  }

  if (!storage.settings || !storage.settings.autoCapture) {
    console.log('Context menu action blocked - auto capture disabled globally');
    return;
  }

  if (info.menuItemId === 'add-link-to-forgor') {
    // Add link
    await handleClipboardSave({
      type: 'CLIPBOARD_LINK',
      content: {
        url: info.linkUrl,
        text: info.linkUrl,
        linkTitle: ''
      },
      url: info.pageUrl,
      title: tab.title,
      timestamp: Date.now()
    }, tab);
    console.log('Added link to forgor via context menu');

  } else if (info.menuItemId === 'add-image-to-forgor') {
    // Add image - need to fetch and compress it
    try {
      // Send message to content script to fetch and compress image
      chrome.tabs.sendMessage(tab.id, {
        type: 'FETCH_IMAGE',
        imageUrl: info.srcUrl
      });
      console.log('Requested image fetch from content script');
    } catch (error) {
      console.error('Error requesting image fetch:', error);
    }
  }
});

async function handleClipboardSave(data, tab) {
  try {
    // Format content preview based on type
    let contentPreview;
    if (typeof data.content === 'string') {
      contentPreview = data.content.substring(0, 50) + '...';
    } else if (data.type === 'CLIPBOARD_IMAGE') {
      contentPreview = '[Image]';
    } else if (data.type === 'CLIPBOARD_LINK') {
      contentPreview = data.content.url;
    } else {
      contentPreview = '[Unknown]';
    }

    console.log('Clipboard event received:', {
      type: data.type,
      content: contentPreview,
      tabId: tab.id,
      url: data.url
    });

    const storage = await chrome.storage.local.get(['clips', 'tabSettings', 'settings', 'tabEnabledStates']);

    // Check if auto capture is enabled globally
    if (!storage.settings || !storage.settings.autoCapture) {
      console.log('Auto capture is disabled globally');
      return;
    }

    // Check if this specific tab is enabled
    const tabId = tab.id.toString();
    const tabEnabledStates = storage.tabEnabledStates || {};
    const isTabEnabled = tabEnabledStates[tabId] !== false; // Default to true

    if (!isTabEnabled) {
      console.log('Auto capture is disabled for tab:', tabId);
      return;
    }

    // Initialize clips array for this tab if it doesn't exist
    if (!storage.clips[tabId]) {
      storage.clips[tabId] = [];
    }

    // Initialize default settings for this tab if not exists
    if (!storage.tabSettings[tabId]) {
      storage.tabSettings[tabId] = {
        retentionType: 'count',
        maxCount: 50,
        retentionValue: 60,
        retentionUnit: 'minutes'
      };
    }

    // Determine content type and create clip object
    let clip = {
      id: generateId(),
      url: data.url,
      title: data.title,
      timestamp: data.timestamp,
      pinned: false
    };

    // Handle different content types
    if (data.type === 'CLIPBOARD_IMAGE') {
      clip.type = 'image';
      clip.content = data.content; // Contains: src, alt, width, height
    } else if (data.type === 'CLIPBOARD_LINK') {
      clip.type = 'link';
      clip.content = data.content; // Contains: url, text, linkTitle
    } else {
      clip.type = 'text';
      clip.content = data.content; // Plain text string
    }

    // Check if this content already exists (avoid duplicates)
    const existingClipIndex = storage.clips[tabId].findIndex(c => {
      if (c.pinned) return false;
      if (c.type !== clip.type) return false;

      if (clip.type === 'text') {
        return c.content === clip.content;
      } else if (clip.type === 'link') {
        return c.content.url === clip.content.url;
      } else if (clip.type === 'image') {
        return c.content.src === clip.content.src;
      }
      return false;
    });

    if (existingClipIndex !== -1) {
      // Update timestamp of existing clip
      storage.clips[tabId][existingClipIndex].timestamp = data.timestamp;
    } else {
      // Add new clip to the beginning
      storage.clips[tabId].unshift(clip);
    }

    // Apply retention policy
    storage.clips[tabId] = applyRetentionPolicy(
      storage.clips[tabId],
      storage.tabSettings[tabId]
    );

    // Save to storage
    await chrome.storage.local.set({ clips: storage.clips });

    console.log('Clip saved successfully!', {
      tabId: tabId,
      totalClips: storage.clips[tabId].length
    });
  } catch (error) {
    console.error('Error saving clipboard:', error);
  }
}

function applyRetentionPolicy(clips, settings) {
  // Separate pinned and unpinned clips
  const pinned = clips.filter(c => c.pinned);
  let unpinned = clips.filter(c => !c.pinned);

  if (settings.retentionType === 'count') {
    // Keep only maxCount items (excluding pinned)
    unpinned = unpinned.slice(0, settings.maxCount);
  } else if (settings.retentionType === 'time') {
    // Calculate retention period in milliseconds
    const multiplier = settings.retentionUnit === 'hours' ? 3600000 : 60000;
    const retentionPeriod = settings.retentionValue * multiplier;

    // Remove items older than retention period
    const cutoffTime = Date.now() - retentionPeriod;
    unpinned = unpinned.filter(c => c.timestamp >= cutoffTime);
  }

  // Combine pinned (at the top) and unpinned
  return [...pinned, ...unpinned];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Clean up old clips periodically (every 5 minutes)
setInterval(async () => {
  try {
    const storage = await chrome.storage.local.get(['clips', 'tabSettings']);

    for (const tabId in storage.clips) {
      if (storage.tabSettings[tabId]) {
        storage.clips[tabId] = applyRetentionPolicy(
          storage.clips[tabId],
          storage.tabSettings[tabId]
        );
      }
    }

    await chrome.storage.local.set({ clips: storage.clips });
  } catch (error) {
    console.error('Error cleaning up clips:', error);
  }
}, 300000); // 5 minutes

// Clean up clips when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    const storage = await chrome.storage.local.get(['clips', 'tabSettings']);

    const tabIdStr = tabId.toString();

    // Remove clips and settings for closed tab
    if (storage.clips[tabIdStr]) {
      delete storage.clips[tabIdStr];
    }
    if (storage.tabSettings[tabIdStr]) {
      delete storage.tabSettings[tabIdStr];
    }

    await chrome.storage.local.set({
      clips: storage.clips,
      tabSettings: storage.tabSettings
    });
  } catch (error) {
    console.error('Error cleaning up closed tab:', error);
  }
});
