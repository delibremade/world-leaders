import { createRoot } from 'react-dom/client';
import { installStorageShim } from '../storage-shim.js';
import App from './App.jsx';

// Entry for the P2 build: the v57 UI running on the engine extracted into src/sim.
installStorageShim(window);
createRoot(document.getElementById('root')).render(<App />);
