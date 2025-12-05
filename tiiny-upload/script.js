// AlienProbe Form Submission Script
// Sends form data to AI Lead OS backend

const API_URL = 'https://staging-agent-code-refactoring-ehii.encr.app/ai-crm/leads';

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('alienprobe-form');
    
    if (!form) {
        console.error('Form not found');
        return;
    }
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Check honeypot (bot protection)
        const botField = document.querySelector('[name="bot-field"]');
        if (botField && botField.value) {
            return; // Bot detected
        }
        
        const submitBtn = document.getElementById('submit-btn');
        const btnText = document.getElementById('btn-text');
        const formStatus = document.getElementById('form-status');
        
        // Show loading state
        submitBtn.disabled = true;
        btnText.textContent = 'Submitting...';
        formStatus.style.display = 'none';
        formStatus.className = 'form-status';
        
        // Collect form data
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            company: document.getElementById('business').value.trim(),
            website: document.getElementById('website').value.trim() || null,
            notes: document.getElementById('challenge').value.trim() || 'From AlienProbe landing page',
            source: 'website'
        };
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Lead created:', result);
                
                // Show success
                formStatus.textContent = '✓ Success! Your request has been received.';
                formStatus.className = 'form-status success';
                formStatus.style.display = 'block';
                
                // Clear form
                form.reset();
                
                // Reset button
                btnText.textContent = 'Get My Free AlienProbe Analysis';
                submitBtn.disabled = false;
                
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Submission failed');
            }
            
        } catch (error) {
            console.error('Form error:', error);
            
            // Determine error message based on context
            let errorMessage = '';
            const errorText = error.message ? error.message.toLowerCase() : '';
            
            if (errorText.includes('internal') || errorText.includes('duplicate') || errorText.includes('already')) {
                // Likely a duplicate email or database issue
                errorMessage = "It looks like you've already requested an analysis, or there was a system issue. If you haven't heard from us, please email help@botcraftwrks.ai and we'll get you sorted immediately.";
            } else if (errorText.includes('network') || errorText.includes('fetch')) {
                // Network issue
                errorMessage = "We couldn't reach our servers. Please check your internet connection and try again.";
            } else {
                // Generic fallback
                errorMessage = "We encountered an issue processing your request. Please try again, or email help@botcraftwrks.ai for immediate assistance.";
            }
            
            formStatus.textContent = errorMessage;
            formStatus.className = 'form-status error';
            formStatus.style.display = 'block';
            
            // Reset button
            btnText.textContent = 'Get My Free AlienProbe Analysis';
            submitBtn.disabled = false;
        }
    });
});

