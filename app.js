import config from './config.js';

// Initialize Firebase
firebase.initializeApp(config.firebase);
const db = firebase.firestore();
const functions = firebase.functions();

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const UI = {
        form: document.getElementById('userForm'),
        status: document.getElementById('status'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        contactsList: document.getElementById('contactsList'),
        searchInput: document.getElementById('searchContacts'),
        filterSelect: document.getElementById('filterRelationship'),
        prevPageBtn: document.getElementById('prevPage'),
        nextPageBtn: document.getElementById('nextPage'),
        pageInfo: document.getElementById('pageInfo'),
        deleteModal: document.getElementById('deleteModal'),
        confirmDeleteBtn: document.getElementById('confirmDelete'),
        cancelDeleteBtn: document.getElementById('cancelDelete'),
        editModal: document.getElementById('editModal'),
        editForm: document.getElementById('editForm'),
        saveEditBtn: document.getElementById('saveEdit'),
        cancelEditBtn: document.getElementById('cancelEdit'),
        sortSelect: document.getElementById('sortBy'),
        detailsModal: document.getElementById('detailsModal'),
        closeDetailsBtn: document.getElementById('closeDetails'),
        settingsBtn: document.getElementById('settingsBtn'),
        settingsModal: document.getElementById('settingsModal'),
        closeSettings: document.getElementById('closeSettings'),
        saveSettings: document.getElementById('saveSettings'),
        cancelSettings: document.getElementById('cancelSettings'),
        settingsTabs: document.querySelectorAll('.settings-tab'),
        settingsSections: document.querySelectorAll('.settings-section'),
    };

    // Helper function to safely get elements
    const safeGetElement = (id, context = document) => {
        const element = context.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    };

    // Helper function to safely query elements
    const safeQueryAll = (selector, context = document) => {
        const elements = context.querySelectorAll(selector);
        if (elements.length === 0) {
            console.warn(`No elements found for selector '${selector}'`);
        }
        return elements;
    };

    // Debug logging for UI initialization
    console.log('Settings initialization:', {
        settingsBtn: !!UI.settingsBtn,
        settingsModal: !!UI.settingsModal,
        settingsTabs: UI.settingsTabs.length,
        settingsSections: UI.settingsSections.length
    });

    // Status Manager for UI notifications
    const StatusManager = {
        show(message, type = 'success') {
            UI.status.textContent = message;
            UI.status.className = `status ${type}`;
            setTimeout(() => {
                UI.status.textContent = '';
            }, 3000);
        },
        showError(message) {
            this.show(message, 'error');
        }
    };

    // Contact data handling
    const ContactManager = {
        currentPage: 1,
        contactsPerPage: 5,
        totalContacts: 0,
        selectedContacts: new Set(),

        async saveContact(formData) {
            try {
                console.log('Saving contact data:', formData);
                const docRef = await db.collection('users').add(formData);
                console.log('Contact saved with ID:', docRef.id);
                
                // Verify the save by fetching the document
                const savedDoc = await docRef.get();
                console.log('Saved document data:', savedDoc.data());
                
                return docRef;
            } catch (error) {
                console.error('Error saving contact:', error);
                throw error;
            }
        },

        getFormData() {
            return {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                dateOfBirth: document.getElementById('dob').value,
                relationship: document.getElementById('relationship').value,
                notes: document.getElementById('notes').value,
                emailNotifications: document.getElementById('emailNotifications').checked,
                reminderDays: parseInt(document.getElementById('reminderDays').value),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
        },

        async getContacts() {
            try {
                console.log('Fetching contacts...');
                const collectionRef = db.collection('users');
                
                // Check if Firebase is initialized
                if (!firebase.apps.length) {
                    throw new Error('Firebase not initialized');
                }

                const snapshot = await collectionRef.get();
                
                if (snapshot.empty) {
                    console.log('No contacts found in database');
                    return [];
                }

                const contacts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                console.log('Total contacts fetched:', contacts.length);
                return contacts;
            } catch (error) {
                console.error('Error fetching contacts:', error);
                throw new Error('Failed to load contacts: ' + error.message);
            }
        },

        calculateDaysUntilBirthday(dateOfBirth) {
            const today = new Date();  // Get current date
            const birthday = new Date(dateOfBirth);  // Convert birthday string to Date object
            
            // Create next birthday date using current year
            const nextBirthday = new Date(
                today.getFullYear(),  // Current year
                birthday.getMonth(),  // Birth month (0-11)
                birthday.getDate()    // Birth day
            );
            
            // If the birthday this year has already passed
            if (nextBirthday < today) {
                // Set to next year's birthday
                nextBirthday.setFullYear(today.getFullYear() + 1);
            }
            
            // Calculate difference in milliseconds
            const diffTime = nextBirthday - today;
            
            // Convert milliseconds to days (rounded up)
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },

        async displayContacts(filter = '', relationship = '') {
            try {
                // Remove any existing bulk controls before adding new ones
                const existingBulkControls = document.querySelector('.bulk-controls');
                if (existingBulkControls) {
                    existingBulkControls.remove();
                }
                
                // Clear selected contacts when refreshing display
                this.selectedContacts.clear();

                const contacts = await this.getContacts();
                
                if (!contacts || contacts.length === 0) {
                    UI.contactsList.innerHTML = '<div class="contact-card">No contacts found</div>';
                    return;
                }
                
                // Filter contacts
                const filteredContacts = contacts.filter(contact => {
                    const matchesSearch = contact.name.toLowerCase().includes(filter.toLowerCase());
                    const matchesRelationship = !relationship || contact.relationship === relationship;
                    return matchesSearch && matchesRelationship;
                });

                // Sort contacts based on selected option
                const sortedContacts = this.sortContacts(filteredContacts, UI.sortSelect.value);
                
                // Calculate pagination
                const startIndex = (this.currentPage - 1) * this.contactsPerPage;
                const endIndex = startIndex + this.contactsPerPage;
                const paginatedContacts = sortedContacts.slice(startIndex, endIndex);
                
                // Group paginated contacts by month
                const groupedContacts = this.groupContactsByMonth(paginatedContacts);
                
                UI.contactsList.innerHTML = Object.entries(groupedContacts)
                    .map(([month, monthContacts]) => {
                        if (monthContacts.length === 0) return '';
                        
                        return `
                            <div class="month-group">
                                <h2 class="month-header">${month}</h2>
                                ${monthContacts.map(contact => `
                                    <div class="contact-card" data-id="${contact.id}">
                                        <div class="contact-select">
                                            <input type="checkbox" class="contact-checkbox" data-id="${contact.id}">
                                        </div>
                                        <div class="contact-info">
                                            <h3>${contact.name}</h3>
                                            <p class="contact-details">
                                                <span class="detail-item">
                                                    <i class="fas fa-user-friends"></i> ${contact.relationship}
                                                </span>
                                                <span class="detail-item">
                                                    <i class="fas fa-envelope"></i> ${contact.email}
                                                </span>
                                                <span class="detail-item">
                                                    <i class="fas fa-birthday-cake"></i> ${this.getAge(contact.dateOfBirth)} years
                                                </span>
                                                <span class="detail-item">
                                                    <i class="fas fa-star"></i> ${this.getZodiacSign(new Date(contact.dateOfBirth))}
                                                </span>
                                            </p>
                                        </div>
                                        <div class="contact-actions">
                                            <div class="days-until">
                                                ${this.calculateDaysUntilBirthday(contact.dateOfBirth)} days
                                            </div>
                                            <button class="edit-btn" aria-label="Edit contact">
                                                <i class="fas fa-edit"></i>
                                            </button>
                                            <button class="delete-btn" aria-label="Delete contact">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }).join('');

                // Add bulk action controls
                const bulkControls = `
                    <div class="bulk-controls" style="display: none;">
                        <span class="selected-count">0 selected</span>
                        <button class="bulk-delete-btn btn-danger">
                            <i class="fas fa-trash"></i> Delete Selected
                        </button>
                    </div>
                `;
                
                UI.contactsList.insertAdjacentHTML('beforebegin', bulkControls);

                // Add click handlers after rendering
                this.addContactCardHandlers();

                // Update pagination controls with total number of contacts
                this.updatePaginationControls(sortedContacts.length);

                // After displaying contacts, check for upcoming birthdays
                this.checkUpcomingBirthdays();
            } catch (error) {
                console.error('Error displaying contacts:', error);
                UI.contactsList.innerHTML = `
                    <div class="contact-card error-card">
                        <p>Error loading contacts: ${error.message}</p>
                        <button onclick="ContactManager.displayContacts()" class="retry-btn">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                `;
            }
        },

        updatePaginationControls(totalContacts) {
            this.totalContacts = totalContacts;
            const totalPages = Math.ceil(totalContacts / this.contactsPerPage);
            
            // Show total contacts and current range
            const startRange = ((this.currentPage - 1) * this.contactsPerPage) + 1;
            const endRange = Math.min(this.currentPage * this.contactsPerPage, totalContacts);
            
            // Format the text with spans for better styling
            UI.pageInfo.innerHTML = `
                <span class="page-range">${startRange}-${endRange}</span>
                <span class="page-total">of ${totalContacts}</span>
                <span class="page-number">Page ${this.currentPage}/${totalPages}</span>
            `;
            
            UI.prevPageBtn.disabled = this.currentPage === 1;
            UI.nextPageBtn.disabled = this.currentPage >= totalPages;
        },

        nextPage() {
            if ((this.currentPage * this.contactsPerPage) < this.totalContacts) {
                this.currentPage++;
                this.displayContacts(UI.searchInput.value, UI.filterSelect.value);
            }
        },

        previousPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.displayContacts(UI.searchInput.value, UI.filterSelect.value);
            }
        },

        async exportContacts() {
            try {
                const contacts = await this.getContacts();
                const csvContent = this.convertToCSV(contacts);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "birthday_contacts.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error('Error exporting contacts:', error);
                UI.status.textContent = 'Error exporting contacts';
            }
        },

        convertToCSV(contacts) {
            const headers = ['Name', 'Email', 'Phone', 'Birthday', 'Relationship', 'Notes'];
            const rows = contacts.map(contact => [
                contact.name,
                contact.email,
                contact.phone,
                contact.dateOfBirth,
                contact.relationship,
                contact.notes
            ]);
            return [headers, ...rows]
                .map(row => row.map(cell => `"${cell || ''}"`).join(','))
                .join('\n');
        },

        sortContacts(contacts, sortBy) {
            return [...contacts].sort((a, b) => {
                switch (sortBy) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'date':
                        return b.timestamp - a.timestamp;
                    case 'birthday':
                        return this.calculateDaysUntilBirthday(a.dateOfBirth) - 
                               this.calculateDaysUntilBirthday(b.dateOfBirth);
                    default:
                        return 0;
                }
            });
        },

        showContactDetails(contact) {
            console.log('Showing contact details:', contact); // Debug log
            
            // Update modal content
            document.getElementById('detailName').textContent = contact.name;
            document.getElementById('detailEmail').textContent = contact.email;
            document.getElementById('detailPhone').textContent = contact.phone || 'Not provided';
            document.getElementById('detailBirthday').textContent = this.formatDate(contact.dateOfBirth);
            document.getElementById('detailRelationship').textContent = contact.relationship;
            document.getElementById('detailNotes').textContent = contact.notes || 'No notes';
            document.getElementById('detailDays').textContent = 
                `${this.calculateDaysUntilBirthday(contact.dateOfBirth)} days until next birthday`;

            // Show modal
            UI.detailsModal.classList.add('show');
        },

        formatDate(dateString) {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString).toLocaleDateString(undefined, options);
        },

        // Update the groupContactsByMonth method
        groupContactsByMonth(contacts) {
            const months = [
                'January', 'February', 'March', 'April', 
                'May', 'June', 'July', 'August',
                'September', 'October', 'November', 'December'
            ];
            
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentDay = today.getDate();
            
            // Sort contacts by days until birthday first
            const sortedContacts = contacts.sort((a, b) => {
                const daysA = this.calculateDaysUntilBirthday(a.dateOfBirth);
                const daysB = this.calculateDaysUntilBirthday(b.dateOfBirth);
                return daysA - daysB;
            });
            
            const grouped = {};
            
            // Initialize months based on contacts we have
            sortedContacts.forEach(contact => {
                const month = months[new Date(contact.dateOfBirth).getMonth()];
                if (!grouped[month]) {
                    grouped[month] = [];
                }
                grouped[month].push(contact);
            });
            
            // Sort the months based on upcoming birthdays
            return Object.fromEntries(
                Object.entries(grouped).sort(([monthA, contactsA], [monthB, contactsB]) => {
                    const monthAIndex = months.indexOf(monthA);
                    const monthBIndex = months.indexOf(monthB);
                    
                    // Get earliest birthday in each month
                    const earliestA = Math.min(...contactsA.map(c => this.calculateDaysUntilBirthday(c.dateOfBirth)));
                    const earliestB = Math.min(...contactsB.map(c => this.calculateDaysUntilBirthday(c.dateOfBirth)));
                    
                    return earliestA - earliestB;
                })
            );
        },

        async requestNotificationPermission() {
            try {
                const permission = await Notification.requestPermission();
                const toggle = document.getElementById('enableNotifications');
                const status = document.querySelector('.notification-status');
                
                if (permission === 'granted') {
                    toggle.checked = true;
                    status.textContent = 'Notifications enabled';
                    status.classList.add('show');
                    setTimeout(() => status.classList.remove('show'), 3000);
                } else {
                    toggle.checked = false;
                    status.textContent = 'Notifications disabled';
                    status.classList.add('show');
                    setTimeout(() => status.classList.remove('show'), 3000);
                }
            } catch (error) {
                console.error('Error requesting notification permission:', error);
            }
        },

        checkUpcomingBirthdays() {
            const NOTIFICATION_DAYS = 7; // Notify for birthdays within 7 days
            
            this.getContacts().then(contacts => {
                contacts.forEach(contact => {
                    const daysUntil = this.calculateDaysUntilBirthday(contact.dateOfBirth);
                    
                    if (daysUntil <= NOTIFICATION_DAYS) {
                        // Show browser notification
                        this.showBirthdayNotification(contact, daysUntil);
                        
                        // Add visual indicator in UI
                        const card = document.querySelector(`.contact-card[data-id="${contact.id}"]`);
                        if (card) {
                            card.classList.add('upcoming-birthday');
                        }
                    }
                });
            });
        },

        showBirthdayNotification(contact, daysUntil) {
            if (Notification.permission === 'granted') {
                const title = `Upcoming Birthday: ${contact.name}`;
                const body = daysUntil === 0 
                    ? "It's their birthday today!" 
                    : `Birthday in ${daysUntil} days!`;
                
                new Notification(title, {
                    body: body,
                    icon: '/assets/favicon.png',
                    badge: '/assets/favicon.png'
                });
            }
        },

        // Group all event handler setup in one place
        initializeEventHandlers() {
            // Bulk action handlers
            document.querySelectorAll('.bulk-delete-btn').forEach(btn => {
                btn.replaceWith(btn.cloneNode(true));
            });
            
            // Add bulk action button handlers
            const bulkDeleteBtn = document.querySelector('.bulk-delete-btn');
            if (bulkDeleteBtn) {
                bulkDeleteBtn.addEventListener('click', () => this.bulkDelete());
            }
        },

        addContactCardHandlers() {
            this.initializeEventHandlers();
            
            document.querySelectorAll('.contact-card').forEach(card => {
                // View contact details
                card.addEventListener('click', async (e) => {
                    // Ignore if clicking edit, delete or checkbox
                    if (e.target.closest('.edit-btn') || 
                        e.target.closest('.delete-btn') || 
                        e.target.closest('.contact-checkbox')) {
                        return;
                    }
                    
                    const contactId = card.dataset.id;
                    try {
                        const doc = await db.collection('users').doc(contactId).get();
                        const contact = doc.data();
                        this.showContactDetails(contact);
                    } catch (error) {
                        console.error('Error loading contact details:', error);
                        UI.status.textContent = 'Error loading contact details';
                    }
                });

                // Edit button handler
                const editBtn = card.querySelector('.edit-btn');
                editBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const contactId = card.dataset.id;
                    await this.editContact(contactId);
                });

                // Delete button handler
                const deleteBtn = card.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const contactId = card.dataset.id;
                    UI.deleteModal.classList.add('show');
                    
                    // Set up delete confirmation
                    UI.confirmDeleteBtn.onclick = () => this.deleteContact(contactId);
                });
            });

            // Add checkbox handlers
            document.querySelectorAll('.contact-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const id = e.target.dataset.id;
                    if (e.target.checked) {
                        this.selectedContacts.add(id);
                    } else {
                        this.selectedContacts.delete(id);
                    }
                    this.updateBulkControls();
                });
            });
        },

        async deleteContact(contactId) {
            try {
                await db.collection('users').doc(contactId).delete();
                UI.deleteModal.classList.remove('show');
                this.displayContacts(); // Refresh the list
                
                StatusManager.show('Contact deleted successfully!');
            } catch (error) {
                console.error('Error deleting contact:', error);
                StatusManager.showError('Error deleting contact');
            }
        },

        async editContact(contactId) {
            try {
                const doc = await db.collection('users').doc(contactId).get();
                const contact = doc.data();
                
                // Populate edit form
                document.getElementById('editName').value = contact.name;
                document.getElementById('editEmail').value = contact.email;
                document.getElementById('editPhone').value = contact.phone || '';
                document.getElementById('editDob').value = contact.dateOfBirth;
                document.getElementById('editRelationship').value = contact.relationship;
                document.getElementById('editNotes').value = contact.notes || '';
                
                // Store contact ID for saving
                UI.editForm.dataset.contactId = contactId;
                
                // Show edit modal
                UI.editModal.classList.add('show');
            } catch (error) {
                console.error('Error loading contact for edit:', error);
                UI.status.textContent = 'Error loading contact';
            }
        },

        async saveEditedContact(contactId, formData) {
            try {
                await db.collection('users').doc(contactId).update(formData);
                UI.editModal.classList.remove('show');
                this.displayContacts(); // Refresh the list
                
                StatusManager.show('Contact updated successfully!');
            } catch (error) {
                console.error('Error updating contact:', error);
                StatusManager.showError('Error updating contact');
            }
        },

        getZodiacSign(date) {
            const month = date.getMonth() + 1;
            const day = date.getDate();

            if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
            if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
            if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
            if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
            if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
            if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
            if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
            if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
            if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
            if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
            if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
            return 'Pisces';
        },

        getAge(dateOfBirth) {
            const today = new Date();
            const birthDate = new Date(dateOfBirth);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            return age;
        },

        async importContacts(file) {
            try {
                const text = await file.text();
                console.log('CSV Content:', text);
                const contacts = this.parseCSV(text);
                
                // Get existing contacts from DB for duplicate checking
                const existingContacts = await this.getContacts();
                const existingKeys = new Set(
                    existingContacts.map(c => `${c.name.toLowerCase()}-${c.dateOfBirth}`)
                );
                
                // Track duplicates within CSV
                const processedKeys = new Set();
                
                let imported = 0;
                let errors = 0;
                let duplicatesInCsv = 0;
                let duplicatesInDb = 0;
                
                for (const contact of contacts) {
                    try {
                        // Validate required fields
                        if (!contact.name || !contact.email || !contact.dateofbirth) {
                            console.error('Missing required fields:', JSON.stringify(contact));
                            errors++;
                            continue;
                        }
                        
                        // Handle different date formats
                        let formattedDate;
                        if (contact.dateofbirth.includes('/')) {
                            const [day, month, year] = contact.dateofbirth.split('/');
                            formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                        } else {
                            formattedDate = contact.dateofbirth;
                        }
                        
                        // Create unique key for duplicate detection
                        const contactKey = `${contact.name.toLowerCase()}-${formattedDate}`;
                        
                        // Check for duplicates within CSV
                        if (processedKeys.has(contactKey)) {
                            console.log('Duplicate in CSV:', contact);
                            duplicatesInCsv++;
                            continue;
                        }
                        
                        // Check for duplicates in DB
                        if (existingKeys.has(contactKey)) {
                            console.log('Already exists in DB:', contact);
                            duplicatesInDb++;
                            continue;
                        }
                        
                        // Add to processed keys
                        processedKeys.add(contactKey);
                        
                        // Add default values for optional fields
                        const contactData = {
                            name: contact.name.trim(),
                            email: contact.email.trim(),
                            phone: contact.phone?.trim() || '',
                            dateOfBirth: formattedDate,
                            relationship: contact.relationship?.toLowerCase() || 'other',
                            notes: contact.notes || '',
                            emailNotifications: true,
                            reminderDays: 7,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        
                        console.log('Importing contact:', contactData);
                        await db.collection('users').add(contactData);
                        imported++;
                    } catch (error) {
                        console.error('Error importing contact:', error);
                        errors++;
                    }
                }
                
                // Show results with more detail
                UI.status.innerHTML = `
                    <strong>Import Results:</strong><br>
                    ✓ Successfully imported: ${imported} contacts<br>
                    ${duplicatesInCsv ? `⚠ Duplicates in CSV: ${duplicatesInCsv}<br>` : ''}
                    ${duplicatesInDb ? `⚠ Already in database: ${duplicatesInDb}<br>` : ''}
                    ${errors ? `✗ Failed to import: ${errors} contacts<br>` : ''}
                    ${errors ? '<small>Check console for error details</small>' : ''}
                `;
                UI.status.style.display = 'block';
                setTimeout(() => UI.status.style.display = 'none', 5000);
                
                // Refresh contacts list
                await this.displayContacts();
                
            } catch (error) {
                console.error('Error importing contacts:', error);
                UI.status.innerHTML = `
                    <strong>Import Error:</strong><br>
                    ${error.message}<br>
                    <small>Check console for more details</small>
                `;
                UI.status.style.display = 'block';
            }
        },

        parseCSV(text) {
            // Split by newline and handle both \r\n and \n
            const lines = text.split(/\r?\n/);
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
            
            console.log('CSV Headers:', headers); // Debug log
            
            return lines.slice(1)
                .filter(line => line.trim())
                .map(line => {
                    const values = line.split(',').map(v => v.replace(/"/g, '').trim());
                    console.log('CSV Values:', values); // Debug log
                    const contact = {};
                    
                    headers.forEach((header, index) => {
                        // Map column names to expected property names
                        let key = header;
                        if (header === 'dateofbirth' || header === 'date of birth') {
                            key = 'dateofbirth';
                        }
                        contact[key] = values[index];
                    });
                    
                    console.log('Parsed Contact:', contact); // Debug log
                    return contact;
                });
        },

        updateBulkControls() {
            const bulkControls = document.querySelector('.bulk-controls');
            const selectedCount = document.querySelector('.selected-count');
            
            if (this.selectedContacts.size > 0) {
                bulkControls.style.display = 'flex';
                selectedCount.textContent = `${this.selectedContacts.size} selected`;
            } else {
                bulkControls.style.display = 'none';
            }
        },

        async bulkDelete() {
            // Show custom delete modal
            const bulkDeleteModal = document.getElementById('bulkDeleteModal');
            const bulkDeleteCount = document.getElementById('bulkDeleteCount');
            bulkDeleteCount.textContent = this.selectedContacts.size;
            bulkDeleteModal.classList.add('show');
            
            // Handle confirmation
            return new Promise((resolve) => {
                const confirmBtn = document.getElementById('confirmBulkDelete');
                const cancelBtn = document.getElementById('cancelBulkDelete');
                
                const cleanup = () => {
                    bulkDeleteModal.classList.remove('show');
                    confirmBtn.removeEventListener('click', handleConfirm);
                    cancelBtn.removeEventListener('click', handleCancel);
                };
                
                const handleConfirm = async () => {
                    cleanup();
                    try {
                        for (const id of this.selectedContacts) {
                            await db.collection('users').doc(id).delete();
                        }
                        
                        this.selectedContacts.clear();
                        this.updateBulkControls();
                        await this.displayContacts();
                        
                        StatusManager.show('Contacts deleted successfully');
                        resolve(true);
                    } catch (error) {
                        console.error('Error deleting contacts:', error);
                        StatusManager.showError('Error deleting contacts');
                        resolve(false);
                    }
                };
                
                const handleCancel = () => {
                    cleanup();
                    resolve(false);
                };
                
                confirmBtn.addEventListener('click', handleConfirm);
                cancelBtn.addEventListener('click', handleCancel);
            });
        }
    };

    function switchTab(tabId) {
        UI.tabContents.forEach(content => content.classList.remove('active'));
        UI.tabs.forEach(tab => tab.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    }

    function setupModalHandlers() {
        // Delete modal handlers
        UI.deleteModal.addEventListener('click', (event) => {
            if (event.target === UI.deleteModal) {
                UI.deleteModal.classList.remove('show');
            }
        });
        
        UI.cancelDeleteBtn.addEventListener('click', () => {
            UI.deleteModal.classList.remove('show');
        });

        // Edit modal handlers
        UI.editModal.addEventListener('click', (event) => {
            if (event.target === UI.editModal) {
                UI.editModal.classList.remove('show');
            }
        });

        UI.cancelEditBtn.addEventListener('click', () => {
            UI.editModal.classList.remove('show');
        });
    }

    // Calendar Manager
    const CalendarManager = {
        currentDate: new Date(),
        
        init() {
            this.updateCalendar();
            this.setupCalendarNavigation();
        },
        
        async getBirthdaysForMonth() {
            try {
                const contacts = await ContactManager.getContacts();
                return contacts.reduce((acc, contact) => {
                    const birthday = new Date(contact.dateOfBirth);
                    // Only include birthdays for current month
                    if (birthday.getMonth() !== this.currentDate.getMonth()) {
                        return acc;
                    }
                    const day = birthday.getDate();
                    if (!acc[day]) {
                        acc[day] = [];
                    }
                    acc[day].push({
                        name: contact.name,
                        age: ContactManager.getAge(contact.dateOfBirth) + 1, // +1 for upcoming birthday
                        date: contact.dateOfBirth
                    });
                    return acc;
                }, {});
            } catch (error) {
                console.error('Error getting birthdays:', error);
                return {};
            }
        },
        
        async updateCalendar() {
            // Update month/year display
            const monthYearText = this.currentDate.toLocaleString('default', { 
                month: 'long', 
                year: 'numeric' 
            });
            document.querySelector('.calendar-month').textContent = monthYearText;

            // Get first day of month and total days
            const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
            const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
            
            // Get birthdays for current month
            const birthdays = await this.getBirthdaysForMonth();
            
            // Clear existing calendar days
            const calendarDays = document.getElementById('calendarDays');
            calendarDays.innerHTML = '';
            
            // Add empty cells for days before start of month
            for (let i = 0; i < firstDay.getDay(); i++) {
                calendarDays.appendChild(document.createElement('div'));
            }
            
            // Add days of month
            for (let day = 1; day <= lastDay.getDate(); day++) {
                const dayElement = document.createElement('div');
                dayElement.textContent = day;
                dayElement.classList.add('calendar-day');
                
                // Add birthday indicators and data
                if (birthdays[day]) {
                    console.log('Adding hover handlers for day:', day);
                    dayElement.classList.add('has-birthday');
                    dayElement.dataset.birthdays = JSON.stringify(birthdays[day]);
                    
                    // Add birthday indicator dot
                    const indicator = document.createElement('span');
                    indicator.classList.add('birthday-indicator');
                    indicator.title = birthdays[day]
                        .map(b => `${b.name} (${b.age})`).join('\n');
                    dayElement.appendChild(indicator);

                    // Add hover handler to the entire day element
                    dayElement.onmouseover = (e) => {
                        console.log('Mouse over event triggered');
                        // Remove any existing tooltips first
                        const existingTooltip = document.querySelector('.birthday-tooltip');
                        if (existingTooltip) {
                            existingTooltip.remove();
                        }

                        // Create tooltip
                        const tooltip = document.createElement('div');
                        tooltip.classList.add('birthday-tooltip');
                        
                        // Get birthday data
                        const birthdayData = JSON.parse(dayElement.dataset.birthdays);
                        console.log('Birthday data:', birthdayData);
                        
                        tooltip.innerHTML = `
                            <strong>Birthdays:</strong><br>
                            ${birthdayData.map(b => `${b.name} (${b.age})`).join('<br>')}
                        `;

                        // Position tooltip
                        const rect = dayElement.getBoundingClientRect();
                        tooltip.style.left = `${rect.left + window.scrollX}px`;
                        tooltip.style.top = `${rect.bottom + window.scrollY}px`;

                        // Add to document
                        document.body.appendChild(tooltip);
                    };

                    dayElement.onmouseout = () => {
                        console.log('Mouse out event triggered');
                        const tooltip = document.querySelector('.birthday-tooltip');
                        if (tooltip) {
                            tooltip.remove();
                        }
                    };

                    // Separate click handler for modal
                    dayElement.onclick = () => {
                        if (birthdays[day]) {
                            this.showBirthdayDetails(birthdays[day], day);
                        }
                    };
                }
                
                calendarDays.appendChild(dayElement);
            }
        },
        
        showBirthdayDetails(birthdays, day) {
            const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
            const birthdayList = birthdays
                .map(b => `
                    <div class="birthday-item">
                        <span class="birthday-name">${b.name}</span>
                        <span class="birthday-age">Turning ${b.age}</span>
                    </div>
                `).join('');

            const modal = document.createElement('div');
            modal.className = 'modal show';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Birthdays on ${monthName} ${day}</h2>
                    </div>
                    <div class="modal-body">
                        ${birthdayList}
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary close-btn">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Close handlers
            const closeBtn = modal.querySelector('.close-btn');
            const closeModal = () => {
                modal.remove();
            };

            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        },
        
        setupCalendarNavigation() {
            const [prevBtn, nextBtn] = document.querySelectorAll('.nav-btn');
            
            prevBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.updateCalendar();
            });
            
            nextBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.updateCalendar();
            });
        }
    };

    // Initialize all event listeners
    function initializeEventListeners() {
        // Pagination handlers
        UI.nextPageBtn.addEventListener('click', () => ContactManager.nextPage());
        UI.prevPageBtn.addEventListener('click', () => ContactManager.previousPage());
        
        // Search and filter handlers
        UI.searchInput.addEventListener('input', (e) => {
            ContactManager.currentPage = 1;
            ContactManager.displayContacts(e.target.value, UI.filterSelect.value);
        });
        
        UI.filterSelect.addEventListener('change', (e) => {
            ContactManager.currentPage = 1;
            ContactManager.displayContacts(UI.searchInput.value, e.target.value);
        });
        
        // Sort handler
        UI.sortSelect.addEventListener('change', () => {
            ContactManager.displayContacts(UI.searchInput.value, UI.filterSelect.value);
        });
        
        // Form submission handler
        UI.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submitted'); // Debug log
            UI.status.textContent = 'Saving contact...';

            try {
                const formData = ContactManager.getFormData();
                console.log('Form data:', formData); // Debug log
                
                await ContactManager.saveContact(formData);
                console.log('Contact saved successfully'); // Debug log
                
                UI.status.textContent = 'Contact saved successfully!';
                UI.form.reset();
                
                // Refresh contacts list
                await ContactManager.displayContacts();
                
                // Clear status after 3 seconds
                setTimeout(() => {
                    UI.status.textContent = '';
                }, 3000);

            } catch (error) {
                console.error('Error saving contact:', error);
                UI.status.textContent = `Error: ${error.message}`;
            }
        });
        
        // Export button handler
        document.getElementById('exportBtn').addEventListener('click', () => {
            ContactManager.exportContacts();
        });
        
        // Details modal close handler
        UI.closeDetailsBtn.addEventListener('click', () => {
            UI.detailsModal.classList.remove('show');
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('view').classList.contains('active')) {
                if (e.key === 'ArrowRight' && !UI.nextPageBtn.disabled) {
                    ContactManager.nextPage();
                } else if (e.key === 'ArrowLeft' && !UI.prevPageBtn.disabled) {
                    ContactManager.previousPage();
                }
            }
        });

        // Modal handlers
        setupModalHandlers();
    }

    // Initialize everything
    initializeEventListeners();
    
    // Initialize calendar
    CalendarManager.init();
    
    // Display initial contacts
    ContactManager.displayContacts();
    
    // Initialize notifications
    if ('Notification' in window) {
        ContactManager.requestNotificationPermission();
    }

    // Check for birthdays every hour
    setInterval(() => {
        ContactManager.checkUpcomingBirthdays();
    }, 3600000); // 1 hour in milliseconds

    // Add tab click handlers
    UI.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Settings modal handlers - moved after UI initialization
    if (UI.settingsBtn) {
        UI.settingsBtn.addEventListener('click', () => {
            UI.settingsModal.classList.add('show');
        });
    } else {
        console.warn("Settings button not found");
    }

    // Use cancelSettings instead of closeSettings
    if (UI.cancelSettings) {
        UI.cancelSettings.addEventListener('click', () => {
            UI.settingsModal.classList.remove('show');
        });
    } else {
        console.warn("Settings cancel button not found");
    }

    // Close settings modal when clicking outside
    UI.settingsModal?.addEventListener('click', (event) => {
        if (event.target === UI.settingsModal) {
            UI.settingsModal.classList.remove('show');
        }
    });

    // Settings tab functionality
    if (UI.settingsTabs.length === 0 || UI.settingsSections.length === 0) {
        console.warn('Settings tabs or sections not found');
    } else {
        UI.settingsTabs.forEach((tab, index) => {
            console.log(`Initializing tab ${index}:`, tab.getAttribute('data-section'));
            tab.addEventListener('click', () => {
                console.log('Tab clicked:', tab.getAttribute('data-section'));
                UI.settingsTabs.forEach(t => t.classList.remove('active'));
                UI.settingsSections.forEach(s => s.classList.remove('active'));
                
                tab.classList.add('active');
                const sectionId = tab.getAttribute('data-section');
                console.log('Looking for section:', sectionId);
                const section = document.getElementById(sectionId);
                if (section) {
                    console.log('Found section, activating');
                    section.classList.add('active');
                } else {
                    console.warn(`Section with id '${sectionId}' not found`);
                }
            });
        });
    }
}); 