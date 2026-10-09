import { createRoot } from 'react-dom/client';
import { installStorageShim } from './storage-shim.js';
import WorldLeaders from '../legacy/world-leaders-v57.jsx';

installStorageShim(window);
createRoot(document.getElementById('root')).render(<WorldLeaders />);
