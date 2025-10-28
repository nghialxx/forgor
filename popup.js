// Popup script for forgor clipboard saver
let currentTabId = null;
let currentTabInfo = null;
let clips = {};
let tabSettings = {};
let settings = {};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await getCurrentTab();
  await loadData();
  await loadTabEnabledState();
  renderClips();
  attachEventListeners();
  setupStorageListener();
});

// Get current active Chrome tab
async function getCurrentTab() {
  // Query for active tab in the last focused window (not popup window)
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  console.log('🔍 Queried for active tab, found:', tabs.length, 'tabs');
  if (tabs[0]) {
    console.log('🔍 Active tab:', tabs[0].id, '-', tabs[0].title);
    currentTabId = tabs[0].id.toString();
    currentTabInfo = tabs[0];
    const titleElement = document.getElementById('currentTabTitle');
    if (titleElement) {
      titleElement.textContent = tabs[0].title;
    }
  }
}

// Load data from storage
async function loadData() {
  const data = await chrome.storage.local.get(['clips', 'tabSettings', 'settings']);
  clips = data.clips || {};
  tabSettings = data.tabSettings || {};
  settings = data.settings || { autoCapture: true };

  console.log('💾 Loaded data from storage:');
  console.log('  - Clips for', Object.keys(clips).length, 'tabs');
  console.log('  - Current tab ID:', currentTabId);
  if (currentTabId && clips[currentTabId]) {
    console.log('  - Clips for current tab:', clips[currentTabId].length);
  }

  // Initialize default settings for current tab if not exists
  if (currentTabId && !tabSettings[currentTabId]) {
    tabSettings[currentTabId] = {
      retentionType: 'count',
      maxCount: 50,
      retentionValue: 60,
      retentionUnit: 'minutes'
    };
    await chrome.storage.local.set({ tabSettings });
  }
}

// Setup storage change listener for real-time updates
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // Update clips if they changed
      if (changes.clips) {
        console.log('🔄 Clips changed in storage, re-rendering...');
        clips = changes.clips.newValue || {};
        console.log('🔄 New clips data:', Object.keys(clips).length, 'tabs');
        if (currentTabId) {
          console.log('🔄 Clips for current tab:', (clips[currentTabId] || []).length);
        }
        renderClips();
      }

      // Update settings if they changed
      if (changes.settings) {
        settings = changes.settings.newValue || { autoCapture: true };
      }

      // Update tab settings if they changed
      if (changes.tabSettings) {
        tabSettings = changes.tabSettings.newValue || {};
      }
    }
  });
}

// Render clips list
function renderClips() {
  const pinnedContainer = document.getElementById('pinnedClips');
  const clipsContainer = document.getElementById('clipsList');
  const emptyState = document.getElementById('emptyState');

  if (!pinnedContainer || !clipsContainer || !emptyState) {
    console.error('Required elements not found');
    return;
  }

  pinnedContainer.innerHTML = '';
  clipsContainer.innerHTML = '';

  const currentClips = clips[currentTabId] || [];

  console.log('📋 Rendering clips for tab:', currentTabId);
  console.log('📋 Total clips in storage:', Object.keys(clips).length, 'tabs');
  console.log('📋 Clips for current tab:', currentClips.length);
  console.log('📋 Clip types:', currentClips.map(c => c.type));

  if (currentClips.length === 0) {
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  const pinned = currentClips.filter(c => c.pinned);
  const unpinned = currentClips.filter(c => !c.pinned);

  pinned.forEach(clip => {
    pinnedContainer.appendChild(createClipElement(clip));
  });

  unpinned.forEach(clip => {
    clipsContainer.appendChild(createClipElement(clip));
  });
}

// Create a clip element
function createClipElement(clip) {
  const div = document.createElement('div');
  div.className = 'clip-item' + (clip.pinned ? ' pinned' : '');
  if (clip.type) {
    div.className += ' clip-' + clip.type;
  }

  const header = document.createElement('div');
  header.className = 'clip-header';

  const content = document.createElement('div');
  content.className = 'clip-content';

  // Render different content types
  if (clip.type === 'image') {
    content.className = 'clip-content clip-image';

    console.log('🖼️ Rendering image clip:', {
      alt: clip.content.alt,
      srcType: clip.content.src.startsWith('data:') ? 'data URL' : 'HTTP URL',
      srcLength: clip.content.src.length,
      srcPreview: clip.content.src.substring(0, 100)
    });

    const img = document.createElement('img');
    img.src = clip.content.src;
    img.alt = clip.content.alt || 'Copied image';
    img.onclick = () => {
      console.log('🖱️ Image clicked! Attempting to copy...');
      copyImageToClipboard(clip.content.src);
    };

    const imgInfo = document.createElement('div');
    imgInfo.className = 'clip-image-info';
    imgInfo.innerHTML = `<span class="material-symbols-outlined">image</span> ${clip.content.alt || 'Image'}`;

    content.appendChild(img);
    content.appendChild(imgInfo);
  } else if (clip.type === 'link') {
    content.className = 'clip-content clip-link';

    const linkIcon = document.createElement('span');
    linkIcon.className = 'material-symbols-outlined clip-link-icon';
    linkIcon.textContent = 'link';

    const linkContent = document.createElement('div');
    linkContent.style.flex = '1';

    const linkText = document.createElement('div');
    linkText.className = 'clip-link-text';
    linkText.textContent = clip.content.text;

    const linkUrl = document.createElement('div');
    linkUrl.className = 'clip-link-url';
    linkUrl.textContent = clip.content.url;

    linkContent.appendChild(linkText);
    linkContent.appendChild(linkUrl);

    content.appendChild(linkIcon);
    content.appendChild(linkContent);
    content.onclick = () => copyToClipboard(clip.content.url);
  } else {
    // Text content
    content.textContent = clip.content;
    content.onclick = () => copyToClipboard(clip.content);
  }

  const actions = document.createElement('div');
  actions.className = 'clip-actions';

  const pinBtn = document.createElement('button');
  pinBtn.className = 'clip-btn pinned-btn' + (clip.pinned ? ' active' : '');
  pinBtn.title = clip.pinned ? 'Unpin' : 'Pin';
  pinBtn.innerHTML = '<span class="material-symbols-outlined">push_pin</span>';
  pinBtn.onclick = (e) => {
    e.stopPropagation();
    togglePin(clip.id);
  };

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'clip-btn';
  deleteBtn.title = 'Delete';
  deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteClip(clip.id);
  };

  actions.appendChild(pinBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(content);
  header.appendChild(actions);

  const meta = document.createElement('div');
  meta.className = 'clip-meta';

  const time = document.createElement('span');
  time.className = 'clip-time';
  time.textContent = formatTimestamp(clip.timestamp);

  const source = document.createElement('span');
  source.className = 'clip-source';
  source.textContent = clip.title || getHostname(clip.url);
  source.title = clip.url;

  meta.appendChild(time);
  meta.appendChild(source);

  div.appendChild(header);
  div.appendChild(meta);

  return div;
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showNotification('Copied to clipboard!');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showNotification('Failed to copy', true);
  }
}

// Copy image to clipboard
async function copyImageToClipboard(imageSrc) {
  try {
    console.log('📋 Copying image:', imageSrc.substring(0, 50));

    // If it's a data URL, we can copy it
    if (imageSrc.startsWith('data:image')) {
      console.log('🖼️ Detected data URL, converting to blob...');

      const response = await fetch(imageSrc);
      const blob = await response.blob();
      console.log('📦 Blob created, type:', blob.type, 'size:', blob.size);

      // Extract MIME type from data URL if blob.type is empty
      let mimeType = blob.type;
      if (!mimeType || mimeType === '') {
        const match = imageSrc.match(/^data:([^;]+);/);
        if (match) {
          mimeType = match[1];
          console.log('🔧 Extracted MIME type from data URL:', mimeType);
        } else {
          mimeType = 'image/png'; // Default fallback
          console.log('⚠️ Could not detect MIME type, using default:', mimeType);
        }
      }

      // Create new blob with correct type if needed
      const finalBlob = mimeType !== blob.type ? new Blob([blob], { type: mimeType }) : blob;
      console.log('✅ Final blob type:', finalBlob.type);

      await navigator.clipboard.write([
        new ClipboardItem({
          [finalBlob.type]: finalBlob
        })
      ]);
      console.log('✅ Image written to clipboard successfully!');
      showNotification('Image copied to clipboard!');
    } else {
      // For regular URLs, copy the URL as text
      console.log('🔗 Copying URL as text');
      await navigator.clipboard.writeText(imageSrc);
      showNotification('Image URL copied to clipboard!');
    }
  } catch (error) {
    console.error('❌ Error copying image to clipboard:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);

    // Fallback: copy URL as text
    try {
      await navigator.clipboard.writeText(imageSrc);
      showNotification('Image URL copied as text (image copy failed)');
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      showNotification('Failed to copy image', true);
    }
  }
}

// Toggle pin status
async function togglePin(clipId) {
  const currentClips = clips[currentTabId] || [];
  const clip = currentClips.find(c => c.id === clipId);

  if (clip) {
    clip.pinned = !clip.pinned;
    await chrome.storage.local.set({ clips });
    renderClips();
  }
}

// Delete a clip
async function deleteClip(clipId) {
  const currentClips = clips[currentTabId] || [];
  clips[currentTabId] = currentClips.filter(c => c.id !== clipId);
  await chrome.storage.local.set({ clips });
  renderClips();
}

// Clear all clips for current tab
async function clearAllClips() {
  clips[currentTabId] = [];
  await chrome.storage.local.set({ clips });
  renderClips();
  closeModal('tabSettingsModal');
  showNotification('All clips cleared');
}

// Format timestamp
function formatTimestamp(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

// Get hostname from URL
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Unknown';
  }
}

// Show notification
function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${isError ? '#cf6679' : '#4caf50'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// Render all tabs list in settings
async function renderAllTabsList() {
  const allTabsList = document.getElementById('allTabsList');

  if (!allTabsList) {
    console.error('allTabsList element not found');
    return;
  }

  allTabsList.innerHTML = '';

  // Get all Chrome tabs
  const tabs = await chrome.tabs.query({});

  tabs.forEach(tab => {
    const tabIdStr = tab.id.toString();
    const clipCount = (clips[tabIdStr] || []).length;

    if (clipCount === 0) return; // Skip tabs with no clips

    const item = document.createElement('div');
    item.className = 'tab-list-item';

    const info = document.createElement('div');
    info.className = 'tab-list-info';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'tab';

    const title = document.createElement('span');
    title.className = 'tab-list-title';
    title.textContent = tab.title;

    info.appendChild(icon);
    info.appendChild(title);

    const count = document.createElement('span');
    count.className = 'tab-list-count';
    count.textContent = clipCount;

    item.appendChild(info);
    item.appendChild(count);

    allTabsList.appendChild(item);
  });

  if (allTabsList.children.length === 0) {
    allTabsList.innerHTML = '<p style="text-align: center; color: #808080; padding: 20px;">No clips saved yet</p>';
  }
}

// Attach event listeners
function attachEventListeners() {
  // Settings button
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.onclick = async () => {
      openModal('settingsModal');
      const autoCaptureCheckbox = document.getElementById('autoCapture');
      if (autoCaptureCheckbox) {
        autoCaptureCheckbox.checked = settings.autoCapture;
      }
      await renderAllTabsList();
    };
  }

  // Tab settings button
  const tabSettingsBtn = document.getElementById('tabSettingsBtn');
  if (tabSettingsBtn) {
    tabSettingsBtn.onclick = () => {
      openTabSettingsModal();
    };
  }

  // Close buttons
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.onclick = (e) => {
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.classList.remove('visible');
      }
    };
  });

  // Save global settings
  const autoCaptureInput = document.getElementById('autoCapture');
  if (autoCaptureInput) {
    autoCaptureInput.onchange = async (e) => {
      settings.autoCapture = e.target.checked;
      await chrome.storage.local.set({ settings });
    };
  }

  // Retention type change
  const retentionTypeSelect = document.getElementById('retentionType');
  if (retentionTypeSelect) {
    retentionTypeSelect.onchange = (e) => {
      const countSetting = document.getElementById('countSetting');
      const timeSetting = document.getElementById('timeSetting');

      if (countSetting && timeSetting) {
        if (e.target.value === 'count') {
          countSetting.style.display = 'block';
          timeSetting.style.display = 'none';
        } else {
          countSetting.style.display = 'none';
          timeSetting.style.display = 'block';
        }
      }
    };
  }

  // Save tab settings
  const saveTabSettingsBtn = document.getElementById('saveTabSettings');
  if (saveTabSettingsBtn) {
    saveTabSettingsBtn.onclick = async () => {
      const retentionTypeEl = document.getElementById('retentionType');
      const maxCountEl = document.getElementById('maxCount');
      const retentionValueEl = document.getElementById('retentionValue');
      const retentionUnitEl = document.getElementById('retentionUnit');

      if (!retentionTypeEl || !maxCountEl || !retentionValueEl || !retentionUnitEl) {
        showNotification('Settings form error', true);
        return;
      }

      const retentionType = retentionTypeEl.value;
      const maxCount = parseInt(maxCountEl.value);
      const retentionValue = parseInt(retentionValueEl.value);
      const retentionUnit = retentionUnitEl.value;

      if (retentionType === 'count' && (!maxCount || maxCount < 1)) {
        showNotification('Please enter a valid count', true);
        return;
      }

      if (retentionType === 'time' && (!retentionValue || retentionValue < 1)) {
        showNotification('Please enter a valid time', true);
        return;
      }

      tabSettings[currentTabId] = {
        retentionType,
        maxCount,
        retentionValue,
        retentionUnit
      };

      await chrome.storage.local.set({ tabSettings });
      closeModal('tabSettingsModal');
      showNotification('Settings saved!');
    };
  }

  // Clear all clips button
  const clearTabClipsBtn = document.getElementById('clearTabClips');
  if (clearTabClipsBtn) {
    clearTabClipsBtn.onclick = async () => {
      if (confirm('Are you sure you want to clear all clips for this tab?')) {
        await clearAllClips();
      }
    };
  }

  // Click outside modal to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove('visible');
      }
    };
  });

  // Tab enabled toggle
  const tabEnabledToggle = document.getElementById('tabEnabledToggle');
  if (tabEnabledToggle) {
    tabEnabledToggle.onchange = async (e) => {
      await toggleTabEnabled(e.target.checked);
    };
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('visible');
  } else {
    console.error('Modal not found:', modalId);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('visible');
  }
}

function openTabSettingsModal() {
  const settings = tabSettings[currentTabId] || {
    retentionType: 'count',
    maxCount: 50,
    retentionValue: 60,
    retentionUnit: 'minutes'
  };

  const settingsTabTitle = document.getElementById('settingsTabTitle');
  const retentionType = document.getElementById('retentionType');
  const maxCount = document.getElementById('maxCount');
  const retentionValue = document.getElementById('retentionValue');
  const retentionUnit = document.getElementById('retentionUnit');
  const countSetting = document.getElementById('countSetting');
  const timeSetting = document.getElementById('timeSetting');

  if (settingsTabTitle) {
    settingsTabTitle.textContent = currentTabInfo?.title || 'Current Tab';
  }
  if (retentionType) {
    retentionType.value = settings.retentionType;
  }
  if (maxCount) {
    maxCount.value = settings.maxCount;
  }
  if (retentionValue) {
    retentionValue.value = settings.retentionValue;
  }
  if (retentionUnit) {
    retentionUnit.value = settings.retentionUnit;
  }

  if (countSetting && timeSetting) {
    if (settings.retentionType === 'count') {
      countSetting.style.display = 'block';
      timeSetting.style.display = 'none';
    } else {
      countSetting.style.display = 'none';
      timeSetting.style.display = 'block';
    }
  }

  openModal('tabSettingsModal');
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// Toggle tab enabled/disabled
async function toggleTabEnabled(enabled) {
  if (!currentTabId) return;

  // Store tab enabled state
  const data = await chrome.storage.local.get(['tabEnabledStates']);
  const tabEnabledStates = data.tabEnabledStates || {};
  tabEnabledStates[currentTabId] = enabled;
  await chrome.storage.local.set({ tabEnabledStates });

  const status = enabled ? 'enabled' : 'disabled';
  showNotification(`Clipboard saving ${status} for this tab`);
  console.log(`Tab ${currentTabId} clipboard saving ${status}`);
}

// Load tab enabled state
async function loadTabEnabledState() {
  if (!currentTabId) return;

  const data = await chrome.storage.local.get(['tabEnabledStates']);
  const tabEnabledStates = data.tabEnabledStates || {};
  const isEnabled = tabEnabledStates[currentTabId] !== false; // Default to true

  const tabEnabledToggle = document.getElementById('tabEnabledToggle');
  if (tabEnabledToggle) {
    tabEnabledToggle.checked = isEnabled;
  }
}

// Select add type
function selectAddType(type) {
  // Update button states
  document.querySelectorAll('.add-type-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-type="${type}"]`).classList.add('active');

  // Show/hide forms
  document.getElementById('addTextForm').style.display = type === 'text' ? 'flex' : 'none';
  document.getElementById('addLinkForm').style.display = type === 'link' ? 'flex' : 'none';
  document.getElementById('addImageForm').style.display = type === 'image' ? 'flex' : 'none';
}

// Paste image from clipboard
async function pasteImageFromClipboard() {
  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      const imageTypes = item.types.filter(type => type.startsWith('image/'));
      if (imageTypes.length > 0) {
        const blob = await item.getType(imageTypes[0]);
        const reader = new FileReader();

        reader.onload = (event) => {
          const previewImg = document.getElementById('previewImg');
          const imagePreview = document.getElementById('imagePreview');
          if (previewImg && imagePreview) {
            previewImg.src = event.target.result;
            imagePreview.style.display = 'block';
          }
        };

        reader.readAsDataURL(blob);
        showNotification('Image pasted!');
        return;
      }
    }

    showNotification('No image found in clipboard', true);
  } catch (error) {
    console.error('Error pasting image:', error);
    showNotification('Failed to paste image', true);
  }
}

// Save manual clip to storage
async function saveManualClipToStorage() {
  if (!currentTabId) {
    showNotification('No active tab', true);
    return;
  }

  // Determine which form is active
  const activeType = document.querySelector('.add-type-btn.active').dataset.type;

  let clip = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
    url: window.location.href,
    title: currentTabInfo ? currentTabInfo.title : document.title,
    timestamp: Date.now(),
    pinned: false
  };

  if (activeType === 'text') {
    const textInput = document.getElementById('manualText');
    const text = textInput.value.trim();

    if (!text) {
      showNotification('Please enter text', true);
      return;
    }

    clip.type = 'text';
    clip.content = text;
  } else if (activeType === 'link') {
    const urlInput = document.getElementById('manualLinkUrl');
    const textInput = document.getElementById('manualLinkText');
    const url = urlInput.value.trim();
    const text = textInput.value.trim();

    if (!url) {
      showNotification('Please enter URL', true);
      return;
    }

    clip.type = 'link';
    clip.content = {
      url: url,
      text: text || url,
      linkTitle: ''
    };
  } else if (activeType === 'image') {
    const urlInput = document.getElementById('manualImageUrl');
    const previewImg = document.getElementById('previewImg');
    const imagePreview = document.getElementById('imagePreview');

    let imageSrc = '';

    // Check if image was pasted
    if (imagePreview && imagePreview.style.display !== 'none' && previewImg.src) {
      imageSrc = previewImg.src;
    } else if (urlInput.value.trim()) {
      imageSrc = urlInput.value.trim();
    }

    if (!imageSrc) {
      showNotification('Please provide an image URL or paste an image', true);
      return;
    }

    clip.type = 'image';
    clip.content = {
      src: imageSrc,
      alt: 'Manually added image',
      width: 0,
      height: 0
    };
  }

  // Add clip to storage
  clips[currentTabId] = clips[currentTabId] || [];
  clips[currentTabId].unshift(clip);

  await chrome.storage.local.set({ clips });

  // Close modal and reset form
  closeModal('manualAddModal');
  resetManualAddForm();
  showNotification('Added to forgor!');
  renderClips();
}

// Reset manual add form
function resetManualAddForm() {
  document.getElementById('manualText').value = '';
  document.getElementById('manualLinkUrl').value = '';
  document.getElementById('manualLinkText').value = '';
  document.getElementById('manualImageUrl').value = '';

  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  if (imagePreview && previewImg) {
    imagePreview.style.display = 'none';
    previewImg.src = '';
  }

  selectAddType('text');
}
