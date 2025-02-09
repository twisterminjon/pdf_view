# PDF Text Highlighter

A React application for highlighting text in PDF documents using PDF.js.

## Prerequisites

- Node.js v21.7.2
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/twisterminjon/pdf_view
cd pdf_view
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Development mode
```bash
npm run dev
```
The application will start on `http://localhost:5173`

### Production build
```bash
npm run build
npm run preview
```

## Docker

You can also run the application using Docker:

1. Build the image:
```bash
docker build -t pdf_view .
```

2. Run the container:
```bash
docker run -p 4173:4173 pdf_view
```

The application will be available at `http://localhost:4173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build locally
