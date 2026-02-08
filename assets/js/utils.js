export function smartParseLinks(rawText) {
    if (!rawText) return [];
    
    const lines = rawText.split('\n');
    const links = [];
    
    // 🧠 ULTRA-SMART REGEX
    // 1. Matches http/https/www explicitly
    // 2. Matches ANY domain (word.extension) where extension is 2+ chars
    // 3. Filters out common code file extensions like .js or .css to avoid false positives
    // 4. Catches long URL paths
    const urlRegex = /((https?:\/\/)|(www\.)|(?!.*(\.js|\.css|\.html)$)[a-zA-Z0-9][a-zA-Z0-9-]{1,61}\.[a-zA-Z]{2,})(\/[^\s]*)?/gi;

    lines.forEach(line => {
        let cleanLine = line.trim();
        if (!cleanLine) return;
        
        // Skip lines that are clearly just the "Day X" header
        if (/^day\s*\d+/i.test(cleanLine)) return;

        // Find ALL links in the line (Global Match)
        // This catches multiple links in one row
        const matches = [...cleanLine.matchAll(urlRegex)];

        if (matches.length > 0) {
            matches.forEach(match => {
                let url = match[0];

                // 🧹 CLEANUP: Remove trailing punctuation
                // Catches things like "google.com," or "(google.com)"
                url = url.replace(/[).,;\]]+$/, "");

                // 🔗 PROTOCOL FIX: Add https if missing
                let finalUrl = url;
                if (!finalUrl.startsWith('http')) {
                    finalUrl = 'https://' + finalUrl;
                }

                // 🏷️ LABEL LOGIC
                let label = "";

                // Scenario A: Line has text + ONE link (e.g., "Two Sum - leetcode.com")
                // We extract "Two Sum" as the label
                if (matches.length === 1) {
                    label = cleanLine.replace(match[0], '')   // Remove the URL text
                                   .replace(/[\[\]()]/g, '')  // Remove remaining brackets
                                   .replace(/^[-:–>\s]+|[-:–<\s]+$/g, '') // Trim separators like "- " or ": "
                                   .trim();
                }

                // Scenario B: No text found OR Multiple links on one line
                // We generate a pretty label from the domain (e.g., "leetcode.com" -> "Leetcode")
                if (!label || label.length < 2) {
                    try {
                        const hostname = new URL(finalUrl).hostname;
                        // Remove 'www.' and get the main name
                        const name = hostname.replace('www.', '').split('.')[0];
                        // Capitalize it (e.g., "leetcode" -> "Leetcode")
                        label = name.charAt(0).toUpperCase() + name.slice(1);
                    } catch (e) {
                        label = "View Link";
                    }
                }

                links.push({ label, url: finalUrl });
            });
        }
    });
    
    return links;
}