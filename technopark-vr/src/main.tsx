import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Experience from './Experience';
createRoot(document.getElementById('root')!).render((location.search.includes('gallery=1') ? <App/> : <Experience/>));
