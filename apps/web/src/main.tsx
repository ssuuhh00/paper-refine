import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import './styles/globals.css';
import { App } from './App';
import { ProjectsPage } from './pages/ProjectsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LauncherPage } from './pages/LauncherPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { ErrorNotesPage } from './pages/ErrorNotesPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'launch', element: <LauncherPage /> },
      { path: 'rounds/:roundId', element: <WorkspacePage /> },
      { path: 'error-notes', element: <ErrorNotesPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
