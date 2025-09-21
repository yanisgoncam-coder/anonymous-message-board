# Anonymous Message Board

## Overview

This is an Anonymous Message Board project built for FreeCodeCamp's Information Security certification. The application allows users to create message boards where they can post threads and replies anonymously. It implements security features using Helmet.js and provides a REST API for managing threads and replies with MongoDB as the data storage solution.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Express.js server with RESTful API design
- **Language**: Node.js with JavaScript
- **Architecture Pattern**: MVC (Model-View-Controller) with separate controllers for threads and replies
- **Security**: Helmet.js middleware for security headers including frame protection, DNS prefetch control, and referrer policy
- **Request Handling**: Body-parser for JSON and URL-encoded data, CORS enabled for cross-origin requests

### Frontend Architecture
- **Static Files**: HTML views served from `/views` directory with CSS styling
- **Client-Side**: jQuery for dynamic content loading and form submissions
- **Routing**: Server-side routing for board pages (`/b/:board/`) and thread pages
- **UI Components**: Separate HTML files for index, board view, and individual thread view

### Data Storage
- **Database**: MongoDB for persistent data storage
- **Collections**: Single `threads` collection storing both threads and their nested replies
- **Data Models**: 
  - Threads contain text, timestamps, delete passwords, and embedded replies array
  - Replies are embedded documents within threads with their own IDs and metadata

### API Structure
- **Thread Endpoints**: 
  - `GET/POST /api/threads/:board` - List recent threads or create new thread
  - `PUT/DELETE /api/threads/:board` - Report or delete specific threads
- **Reply Endpoints**:
  - `GET/POST /api/replies/:board` - Get thread with all replies or add new reply
  - `PUT/DELETE /api/replies/:board` - Report or delete specific replies
- **Response Format**: JSON with filtered fields (passwords and reported status hidden from GET requests)

### Security Features
- **Password Protection**: Delete passwords required for thread/reply deletion (hashed storage recommended)
- **Reporting System**: Users can report inappropriate content without authentication
- **Input Validation**: ObjectId validation for MongoDB document references
- **Headers Security**: Helmet.js configured for frame protection and secure headers
- **Data Filtering**: Sensitive fields (passwords, reported status) excluded from public API responses

## External Dependencies

- **Database**: MongoDB (version 6.20.0) for data persistence
- **Web Framework**: Express.js for HTTP server and routing
- **Security**: Helmet.js for security headers and protection
- **Environment**: dotenv for environment variable management
- **Testing**: Mocha and Chai for functional testing suite
- **Utilities**: CORS for cross-origin requests, body-parser for request parsing