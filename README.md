# Birthday Reminder App

A web application to help users manage and receive notifications for upcoming birthdays.

## Features

- 👥 Contact Management
  - Add/Edit/Delete contacts
  - Store birthday information
  - Add notes and relationship details
  - Bulk actions for contacts

- 📅 Calendar View
  - Visual calendar interface
  - Birthday indicators
  - Quick view of upcoming birthdays
  - Month navigation

- ✉️ Email Notifications
  - Customizable reminder settings
  - Email notifications for upcoming birthdays
  - SendGrid integration for reliable delivery

- ⚙️ Settings & Preferences
  - Theme customization
  - Language preferences
  - Date format settings
  - Notification preferences

## Tech Stack

- Frontend: HTML, CSS, JavaScript (Vanilla)
- Backend: Node.js, Express
- Database: Firebase Firestore
- Email Service: SendGrid
- Hosting: Firebase Hosting

## Project Structure 


bash
birthday-reminder-app/
├── assets/ # Static assets and images
├── functions/ # Firebase Cloud Functions
│ ├── index.js # Email notification functions
│ └── package.json # Functions dependencies
├── app.js # Main application logic
├── index.html # Main HTML file
├── styles.css # Application styles
├── server.js # Express server
└── config.example.js # Configuration template

## Setup Instructions
1. **Clone the repository**

*
bash
git clone https://github.com/vapmail16/birthday-reminder-app.git
cd birthday-reminder-app
2. **Install dependencies**
*
bash
npm install

3. **Firebase Setup**
- Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
- Copy `config.example.js` to `config.js`
- Add your Firebase credentials:
  ```javascript
  const config = {
    firebase: {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      // ... other credentials
    }
  };
  ```

4. **SendGrid Setup**
- Create a SendGrid account
- Set up API keys
- Configure email templates

5. **Start the application**
*
bash
Development mode
npm run dev
Production mode
npm start

## Available Scripts

- `npm start`: Runs the app in production mode
- `npm run dev`: Runs the app in development mode with hot reload

## Environment Variables

Create a `.env` file with:

env
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_SENDER=your_verified_sender_email

## Firebase Functions

Deploy Firebase functions:

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

