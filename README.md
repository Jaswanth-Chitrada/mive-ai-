# Mive AI

Mive AI is an intelligent chat application that integrates seamlessly with Gmail, allowing users to manage their emails and interact with an AI assistant in a modern, responsive interface.

## 🚀 Features

- **AI Chat Interface**: Interactive chat experience powered by advanced AI.
- **Gmail Integration**: Securely connect your Gmail account to read and send emails directly from the app.
- **Google Sign-In**: Easy and secure authentication using Google OAuth.
- **Responsive Design**: Beautiful UI built with React, featuring smooth animations and a modern aesthetic.
- **Team Showcase**: Carousel view of the development team.

## 🛠️ Tech Stack

### Frontend
- **React**: UI library for building the interface.
- **React Router**: For navigation and routing.
- **Spline**: For 3D interactive scenes.
- **Slick Carousel**: For the team member showcase.
- **React Icons**: For iconography.

### Backend
- **Node.js & Express**: Server-side runtime and framework.
- **Firebase Admin**: For authentication and database interactions.
- **Google OAuth2**: For handling Gmail permissions and user authentication.
- **Axios**: For making HTTP requests.
- **n8n**: Integration for workflow automation (webhook support).

## 📂 Project Structure

```
mive-ai-/
├── src/                # Frontend source code
│   ├── components/     # React components (LoginPage, ChatPage)
│   └── App.js          # Main application component
├── mive/
│   └── backend/        # Backend server code
│       └── server.js   # Express server entry point
└── package.json        # Frontend dependencies
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)
- Firebase Project
- Google Cloud Console Project (for OAuth)

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd mive-ai-
    ```

2.  **Frontend Setup**
    ```bash
    # Install dependencies
    npm install

    # Start the development server
    npm start
    ```
    The application will run on `http://localhost:3000`.

3.  **Backend Setup**
    ```bash
    cd mive/backend

    # Install dependencies
    npm install

    # Start the server
    node server.js
    ```
    The server will run on `http://localhost:5000`.

## 🔑 Environment Variables

### Backend (`mive/backend/.env`)
Create a `.env` file in the `mive/backend` directory with the following keys:

```env
PORT=5000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/gmail/callback
```

### Frontend
Ensure your frontend is configured to communicate with `http://localhost:5000`.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
