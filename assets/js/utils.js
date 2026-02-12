export function smartParseLinks(rawText) {
    if (!rawText) return [];
    
    const lines = rawText.split(/\r?\n/);
    const links = [];
    
    // 🧠 ULTRA-SMART REGEX
    // 1. Matches http/s or www.
    // 2. OR matches domains ending in common TLDs to catch "bare" links (e.g. leetcode.com)
    // 3. Excludes things that look like filenames but aren't links
    const urlRegex = /((https?:\/\/)|(www\.)|([a-zA-Z0-9-]+\.(com|org|net|io|in|me|app|dev|edu|gov|co|biz|info)))([\/\w\.-]*)*\/?/gi;
    const junkRegex = /\.(css|js|json|html|png|jpg|jpeg|gif|svg)$/i;

    lines.forEach(line => {
        const cleanLine = line.trim();
        // Skip purely numeric/header lines if they are short (e.g. "Day 10")
        if (!cleanLine || (/^(day|update)\s*\d*/i.test(cleanLine) && cleanLine.length < 15)) return;

        const matches = cleanLine.match(urlRegex);

        if (matches && matches.length > 0) {
            matches.forEach(match => {
                let url = match;
                
                // 🛑 Skip junk (e.g. "style.css")
                if (junkRegex.test(url)) return;

                // 🧹 Cleanup trailing punctuation (e.g. "leetcode.com.")
                url = url.replace(/[.,;)]+$/, "");

                // 🔗 Protocol Fixer (ensure https://)
                let finalUrl = url;
                if (!finalUrl.startsWith('http')) {
                    finalUrl = 'https://' + finalUrl;
                }

                // 🏷️ Label Extractor
                // Strategy 1: Use remaining text in the line (e.g. "Two Sum - https://...")
                let label = cleanLine.replace(match, '')
                                   .replace(/[\[\]()]/g, '')
                                   .replace(/^[-:–>\s]+|[-:–<\s]+$/g, '') // Trim separators like " - "
                                   .trim();

                // Strategy 2: If no text, use the Domain Name (e.g. "Leetcode Problem")
                if (!label || label.length < 2 || label.toLowerCase() === 'link') {
                    try {
                        const u = new URL(finalUrl);
                        const hostname = u.hostname.replace(/^www\./, '');
                        // Get main domain (e.g. "leetcode.com" -> "Leetcode")
                        const parts = hostname.split('.');
                        let name = parts[0];
                        if (parts.length > 2) name = parts[1]; // Handle subdomains
                        
                        label = name.charAt(0).toUpperCase() + name.slice(1);
                        
                        // Add path hint if useful
                        if (u.pathname.length > 1) label += " Problem";
                    } catch (e) {
                        label = "External Link";
                    }
                }

                links.push({ label, url: finalUrl });
            });
        }
    });
    
    return links;
}