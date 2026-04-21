import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- API Access Interceptor ---
const apiKey = localStorage.getItem('apiKey');
const apiTerminalOverlay = document.getElementById('api-terminal-overlay')!;
const rootElement = document.getElementById('root')!;

if (!apiKey) {
  rootElement.style.display = 'none'; // Hide the main app
  apiTerminalOverlay.style.display = 'flex'; // Show the terminal

  const connectButton = document.getElementById('connect-button')!;
  const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
  const apiModelInput = document.getElementById('api-model') as HTMLInputElement;
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
  const showTutorialButton = document.getElementById('show-tutorial')!;
  const closeTutorialButton = document.getElementById('close-tutorial')!;
  const tutorialModal = document.getElementById('api-tutorial-modal')!;

  connectButton.addEventListener('click', () => {
    const apiUrl = apiUrlInput.value.trim();
    const apiModel = apiModelInput.value.trim();
    const key = apiKeyInput.value.trim();

    if (apiUrl && apiModel && key) {
      localStorage.setItem('apiUrl', apiUrl);
      localStorage.setItem('apiModel', apiModel);
      localStorage.setItem('apiKey', key);
      
      apiTerminalOverlay.style.display = 'none';
      rootElement.style.display = 'block'; // Show the main app
      // No page reload needed, just render the app
      renderApp();
    } else {
      alert('请填写所有字段！');
    }
  });

  showTutorialButton.addEventListener('click', (e) => {
    e.preventDefault();
    tutorialModal.style.display = 'flex';
  });

  closeTutorialButton.addEventListener('click', () => {
    tutorialModal.style.display = 'none';
  });

} else {
  renderApp();
}

function renderApp() {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
