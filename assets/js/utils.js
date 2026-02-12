/**
 * 🔗 QUANTUM LINK PARSER v3.0 (Context Aware)
 * 1. Detects if user provided a label (e.g. "My Solution - http...")
 * 2. Falls back to Smart Labeling only if raw link is found.
 * 3. Handles multiple links per line or multiple lines.
 */
export function smartParseLinks(text) {
    if (!text) return [];

    const links = [];
    const lines = text.split('\n'); // Process line-by-line to keep context

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 1. EXTRACT URL
        // Finds http, https, or www.
        const urlRegex = /((https?:\/\/)|(www\.))[^\s,)]+/i;
        const match = trimmed.match(urlRegex);

        if (match) {
            let url = match[0];
            // Clean trailing punctuation
            url = url.replace(/[.,;)]+$/, "");

            // Normalize protocol
            let finalUrl = url;
            if (!url.startsWith("http")) finalUrl = "https://" + url;

            // 2. DETERMINE LABEL
            // Remove the URL from the line to see if there is text left
            let potentialLabel = trimmed.replace(match[0], "").trim();

            // Cleanup common separators people use (e.g., " - ", ": ", "Link ->")
            potentialLabel = potentialLabel.replace(/^[-:=>•\s]+|[-:<=•\s]+$/g, "");

            let finalLabel = "";

            if (potentialLabel.length > 1) {
                // ✅ CASE A: USER PROVIDED A LABEL
                finalLabel = potentialLabel;
            } else {
                // 🤖 CASE B: AUTO-GENERATE SMART LABEL
                const lowerUrl = finalUrl.toLowerCase();
                
                if (lowerUrl.includes("leetcode.com")) finalLabel = "LeetCode Problem 🧠";
                else if (lowerUrl.includes("github.com")) finalLabel = "GitHub Repo 💻";
                else if (lowerUrl.includes("drive.google.com")) finalLabel = "Google Drive 📂";
                else if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) finalLabel = "YouTube Video 📺";
                else if (lowerUrl.includes("geeksforgeeks.org")) finalLabel = "GeeksForGeeks 🟢";
                else if (lowerUrl.includes("hackerrank.com")) finalLabel = "HackerRank 🚩";
                else if (lowerUrl.includes("codechef.com")) finalLabel = "CodeChef 👨‍🍳";
                else if (lowerUrl.includes("figma.com")) finalLabel = "Figma Design 🎨";
                else if (lowerUrl.includes("notion.so")) finalLabel = "Notion Doc 📝";
                else if (lowerUrl.includes("linkedin.com")) finalLabel = "LinkedIn Post 💼";
                else {
                    try {
                        const urlObj = new URL(finalUrl);
                        finalLabel = urlObj.hostname.replace("www.", "") + " 🔗";
                    } catch (e) {
                        finalLabel = "External Resource 🔗";
                    }
                }
            }

            links.push({
                url: finalUrl,
                label: finalLabel
            });
        }
    });

    return links;
}