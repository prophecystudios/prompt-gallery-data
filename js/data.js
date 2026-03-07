// GitHub Raw URL for prompts data (using jsdelivr for faster cache updates)
const GITHUB_DATA_URL = 'https://cdn.jsdelivr.net/gh/prophecystudios/prompt-gallery-data@main/prompts.json';

// Prompts array - will be populated from GitHub
let prompts = [];

// Fetch prompts from GitHub
async function fetchPrompts() {
    try {
        // Add cache-busting parameter to avoid browser caching
        const cacheBuster = `?t=${Date.now()}`;
        const response = await fetch(GITHUB_DATA_URL + cacheBuster);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Map the data to ensure consistent field names
        prompts = data.map(item => ({
            id: item.id,
            title: item.title || `Prompt ${item.id}`, // Use title if exists, otherwise generate
            prompt: item.prompt,
            image: item.image_url || item.image || 'https://picsum.photos/seed/placeholder/400/400', // Fallback image
            category: item.category ? item.category.toLowerCase() : 'other', // Ensure lowercase
            date: item.date || '2000-01-01' // Default date for items without date
        }));
        
        // Sort by date (newest first)
        prompts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log('Prompts data (sorted by date):', prompts); // Debug log
        
        console.log(`Loaded ${prompts.length} prompts from GitHub`);
        return prompts;
    } catch (error) {
        console.error('Error fetching prompts:', error);
        // Return empty array on error - app will show empty state
        return [];
    }
}

// Fallback sample data in case GitHub fetch fails
const samplePrompts = [
    {
        id: 1,
        title: "Sample Prompt",
        prompt: "A professional portrait photo with dramatic lighting",
        image: "https://picsum.photos/seed/sample1/400/400",
        category: "men"
    }
];