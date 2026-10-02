# UniServe

A web application for university service requests, appointments, and queue tracking.

## Requirements

- Node.js (v18 or newer recommended)

## How to Run Locally

1. Open a terminal or command prompt.
2. Navigate to the project root directory:
   ```cmd
   cd "path\to\project"
   ```
3. Install dependencies:
   ```cmd
   npm install
   ```
4. Start the server:
   ```cmd
   npm start
   ```
5. Open your browser and visit:
   ```
   http://localhost:5000
   ```

The server automatically hosts both the backend API and the frontend interface. If MongoDB is not configured or reachable, it falls back to an in-memory database automatically.

## Default Accounts

- **Staff**:
  - Email: `staff@uniserve.edu.au`
  - Password: `staff1234`
- **Student**:
  - Click Register on the login screen to create a new student account.

## Run Tests (Optional)

```cmd
npm test
```
