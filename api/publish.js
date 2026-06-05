export default async function handler(req, res) {
  try {

    // Get next keyword from Google Sheet
    const sheetResponse = await fetch(process.env.SHEET_URL);
    const sheetData = await sheetResponse.json();

    if (!sheetData.keyword) {
      return res.status(200).json({
        success: false,
        message: "No Pending Keywords"
      });
    }

    const keyword = sheetData.keyword;
    const slug = sheetData.slug;

    // Generate article with OpenAI
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: `
You are a professional entertainment journalist and SEO writer.

Generate content that reads naturally and does not sound AI-generated.

Requirements:

- Minimum 1500 words
- Write in HTML only
- DO NOT use Markdown
- DO NOT use ### headings
- DO NOT use ## headings
- DO NOT use **bold**
- Use proper HTML tags only

Use:

<h2>Main Sections</h2>
<h3>Sub Sections</h3>
<p>Paragraphs</p>
<ul>
<li>List Items</li>
</ul>

Content Guidelines:

- Write engaging introductions
- Answer search intent immediately
- Use short paragraphs
- Add FAQs near the end
- Avoid repetitive wording
- Avoid AI clichés
- Avoid phrases like:
  - "In today's world"
  - "Delve into"
  - "Dive deep"
  - "In conclusion"

SEO Requirements:

- Create a compelling article title
- Create a separate SEO title optimized for Google
- Create a meta description between 140 and 160 characters
- Create a focus keyword matching search intent
- Naturally include the target keyword
- Use keyword in introduction
- Use keyword in at least one H2

Cast Article Requirements:

- Include cast overview
- Character details where available
- Actor information where available

Review Article Requirements:

- Plot summary
- What worked
- What didn't work
- Verdict

Release Date Article Requirements:

- Latest updates
- Expected timeline
- FAQ section

Return ONLY valid JSON:

{
  "title":"",
  "seoTitle":"",
  "metaDescription":"",
  "focusKeyword":"",
  "content":""
}
`
            },
            {
              role: "user",
              content: keyword
            }
          ]
        })
      }
    );

    const openaiData = await openaiResponse.json();

    if (!openaiData.choices) {
      return res.status(500).json({
        success: false,
        error: openaiData
      });
    }

    const article = JSON.parse(
      openaiData.choices[0].message.content
    );

    // WordPress Authentication
    const auth = Buffer.from(
      `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
    ).toString("base64");

    // Publish Post
    const wpResponse = await fetch(
      `${process.env.WORDPRESS_URL}/wp-json/wp/v2/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: article.title,
          content: article.content,
          excerpt: article.metaDescription,
          slug: slug.replace("/", ""),
          status: "draft",

          meta: {
            _yoast_wpseo_title: article.seoTitle,
            _yoast_wpseo_metadesc: article.metaDescription,
            _yoast_wpseo_focuskw: article.focusKeyword
          }
        })
      }
    );

    const wpPost = await wpResponse.json();

    // Mark Google Sheet Row as Published
    await fetch(process.env.SHEET_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        row: sheetData.row
      })
    });

    return res.status(200).json({
      success: true,
      keyword,
      slug,
      seoTitle: article.seoTitle,
      focusKeyword: article.focusKeyword,
      postId: wpPost.id,
      postUrl: wpPost.link
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
