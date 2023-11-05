document.addEventListener('DOMContentLoaded', (event) => {
    fetchCategories();
});

function formatCategoryName(categoryName) {
    return categoryName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
}

async function fetchCategories() {
    try {
        const response = await fetch('https://us-central1-kate-6055a.cloudfunctions.net/get-categories');
        if (!response.ok) {
            console.error('Failed to fetch categories:', response.statusText);
            return;
        }

        const { categories } = await response.json();
        const categorySelect = document.getElementById('category');
        categorySelect.innerHTML = categories.map(category =>
            `<option value="${category}">${formatCategoryName(category)}</option>`
        ).join('');
    } catch (error) {
        console.error('Error fetching categories:', error);
    }
}

function submitInsult() {
    event.preventDefault();
    const username = document.getElementById('username').value;  // Get the username
    const insultInput = document.getElementById('insult');
    const categorySelect = document.getElementById('category');
    const submitButton = document.querySelector('button');

    const insult = insultInput.value;
    const category = categorySelect.value;

    if (!category) {
        console.error('No category selected');
        return;
    }

    submitButton.textContent = 'Submitting...';

    fetch('https://us-central1-kate-6055a.cloudfunctions.net/submit-insult', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, insult, category }),  // Include the username in the request body
    })
    .then(response => {
        if (!response.ok) {
            console.error('Server error:', response.statusText);
            return Promise.reject(response.statusText);
        }
        return response.json();
    })
    .then(data => {
        insultInput.value = '';  // Clear the text input
        submitButton.textContent = 'Insult Submitted!';
    })
    .catch(error => {
        console.error('Error:', error);
        submitButton.textContent = 'Submit';
    });
}

// Add an event listener to change the button text back when the user starts typing again
document.getElementById('insult').addEventListener('input', () => {
    document.querySelector('button').textContent = 'Submit';
});