export function smartParseLinks(rawText) {
    if (!rawText) return [];
    
    // Split by newlines to handle multiple links
    const lines = rawText.split('\n');
    const links = [];
    
    // AGGRESSIVE REGEX: Matches http, https, www, or typical domains (example.com)
    // This catches "leetcode.com" even without https://
    const urlRegex = /((https?:\/\/)|(www\.)|[a-zA-Z0-9-]+\.(com|org|net|edu|io|app))[^\s]*/i;

    lines.forEach(line => {
        const cleanLine = line.trim();
        
        // Skip lines that are clearly just the Header (e.g. "Day 5")
        if (cleanLine.toLowerCase().startsWith('day ')) return;
        if (!cleanLine) return;

        const match = cleanLine.match(urlRegex);
        if (match) {
            let url = match[0];
            
            // 🔧 AUTO-FIX: If http is missing, add it.
            // (e.g., "leetcode.com" -> "https://leetcode.com")
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }

            // Extract the text AROUND the link to use as the label
            // e.g., "Two Sum - leetcode.com" -> Label: "Two Sum"
            let label = cleanLine.replace(match[0], '')
                                .replace(/[:-]/g, '') // Remove colons/dashes
                                .trim();
            
            // Default label if they just pasted a raw link
            if (!label) label = "Submission Link";
            
            links.push({ label, url });
        }
    });
    
    return links;
}