const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const cors = require('cors')({ origin: true });

// Get config from Firebase environment
const config = functions.config();

// Initialize admin and SendGrid
admin.initializeApp();
sgMail.setApiKey(config.sendgrid.key);

const EMAIL_CONFIG = {
    from: {
        email: config.email.sender_email || 'birthdayreminder.app@outlook.com',
        name: config.email.sender_name || 'Birthday Reminder App'
    },
    templates: {
        birthdayReminder: {
            subject: "🎂 Birthday Reminder for {{name}}",
            text: "{{name}}'s birthday is in {{days}} days!",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #FF9EAA;">Birthday Reminder! 🎂</h2>
                    <p style="font-size: 16px; color: #696969;">
                        {{name}}'s birthday is coming up in {{days}} days!
                    </p>
                    <div style="margin-top: 20px; padding: 15px; background-color: #FFF0F5; border-radius: 10px;">
                        <p style="margin: 0; color: #696969;">
                            <strong>Date:</strong> {{date}}
                        </p>
                        {{#if notes}}
                        <p style="margin: 10px 0 0 0; color: #696969;">
                            <strong>Notes:</strong> {{notes}}
                        </p>
                        {{/if}}
                    </div>
                </div>
            `
        }
    }
};

// Helper function to calculate days until birthday
function calculateDaysUntilBirthday(dateOfBirth) {
    const today = new Date();
    const birthday = new Date(dateOfBirth);
    const nextBirthday = new Date(
        today.getFullYear(),
        birthday.getMonth(),
        birthday.getDate()
    );
    
    if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = nextBirthday - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Function to send birthday reminder emails
exports.sendBirthdayEmails = functions.pubsub.schedule('0 0 * * *')  // Run daily at midnight
    .timeZone('America/New_York')
    .onRun(async (context) => {
        try {
            // Get all contacts
            const snapshot = await admin.firestore().collection('users').get();
            const contacts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Process each contact
            for (const contact of contacts) {
                // Skip if email notifications are disabled
                if (!contact.emailNotifications) continue;
                
                const daysUntil = calculateDaysUntilBirthday(contact.dateOfBirth);
                
                // Check if we should send notification based on reminder preference
                if (daysUntil === contact.reminderDays) {
                    const msg = {
                        to: contact.email,
                        from: EMAIL_CONFIG.from,
                        subject: 'Birthday Reminder',
                        text: `${contact.name}'s birthday is in ${daysUntil} days!`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #FF9EAA;">Birthday Reminder! 🎂</h2>
                                <p style="font-size: 16px; color: #696969;">
                                    ${contact.name}'s birthday is in ${daysUntil} days!
                                </p>
                                <p style="font-size: 16px; color: #696969;">
                                    Don't forget to wish them!
                                </p>
                                <div style="margin-top: 20px; padding: 15px; background-color: #FFF0F5; border-radius: 10px;">
                                    <p style="margin: 0; color: #696969;">
                                        <strong>Birthday:</strong> ${new Date(contact.dateOfBirth).toLocaleDateString()}
                                    </p>
                                    ${contact.notes ? `
                                        <p style="margin: 10px 0 0 0; color: #696969;">
                                            <strong>Notes/Gift Ideas:</strong> ${contact.notes}
                                        </p>
                                    ` : ''}
                                </div>
                            </div>
                        `
                    };
                    
                    await sgMail.send(msg);
                    console.log(`Sent birthday reminder for ${contact.name}`);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error sending birthday emails:', error);
            return null;
        }
    });

// Email sending function
exports.sendEmail = functions.https.onCall(async (data, context) => {
    // Add input validation
    if (!data.to || !data.subject || !data.text) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
        const msg = {
            to: data.to,
            from: EMAIL_CONFIG.from,
            subject: data.subject,
            text: data.text,
            html: data.html
        };

        await sgMail.send(msg);
        return { success: true };
    } catch (error) {
        console.error('Email error:', error);
        throw new functions.https.HttpsError('internal', 'Error sending email');
    }
});

// Rename the function to avoid conflict
exports.testEmailHttp = functions.https.onRequest(async (req, res) => {
    // Wrap the function in cors middleware
    return cors(req, res, async () => {
        try {
            const msg = {
                to: 'birthdayreminder.app@outlook.com',
                from: EMAIL_CONFIG.from,
                subject: 'Test Email from Birthday App',
                text: 'This is a test email from your Birthday App',
                html: '<strong>This is a test email from your Birthday App</strong>',
            };

            await sgMail.send(msg);
            res.status(200).send('Test email sent successfully!');
        } catch (error) {
            console.error('Error sending test email:', error);
            res.status(500).send('Error sending test email: ' + error.message);
        }
    });
}); 