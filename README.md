# Kortana GUI

A modern, modular desktop application interface for the Kortana intelligence platform. Built with React, TypeScript, and Vite, this project provides a unified workspace for managing multiple data visualization and interaction panels.

## Features

- **Multi-Panel Workspace**: Dynamically manage multiple panel types in a flexible layout
  - Context Graph - Visualize relationships and context
  - Intelligence Map - Interactive mapping with MapLibre GL
  - Chat - Real-time communication interface
  - Log Stream - Live event monitoring and logging
  - Markdown - Rich text document rendering
  - Trading - Data-driven trading interface
  - Comms - Communication management
  - Terminal - Command execution and output

- **Dual Canvas Modes**: Switch between free-form canvas layout and structured dashboard
- **Command Palette**: Quick access to commands with Cmd+K (Ctrl+K on Windows/Linux)
- **Real-time Connection Monitoring**: Health checks with the backend Kortana API server
- **Responsive Layout**: Tailwind CSS styling with dynamic window management
- **State Management**: Zustand for efficient, scalable state management

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5
- **Visualization**: D3.js 7, MapLibre GL 5
- **Markdown**: Marked 17
- **Linting**: ESLint 9 with TypeScript support

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm or your preferred package manager

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will start at `http://localhost:5173` with hot module replacement enabled.

### Building

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Project Structure

```
src/
├── canvas/          # Canvas modes (dashboard and free-form)
├── hooks/           # Custom React hooks (connection management)
├── layouts/         # Layout presets and configurations
├── lib/             # Utilities and API clients
├── panels/          # Panel components and registry
├── sidebar/         # Chat sidebar and messaging UI
├── store/           # Zustand state stores
├── styles/          # Global CSS and styling
├── types/           # TypeScript type definitions
└── ui/              # Reusable UI components
```

## Configuration

The application connects to a Kortana API server running on `http://localhost:4000`. Health checks are performed every 10 seconds to monitor connection status.

## Future Enhancements

- React Compiler integration for performance optimization
- Enhanced type-aware ESLint rules
- Additional panel types and visualizations
- Collaborative workspace features
