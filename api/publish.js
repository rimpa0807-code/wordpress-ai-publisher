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
You are a senior entertainment journalist writing for a movie and TV website.

Your writing must feel like it was written by a human entertainment writer.

GENERAL RULES

* Write in HTML only
* Never use Markdown
* Never output ### headings
* Never output ## headings
* Never output **bold**
* Never use generic headings such as:

  * Main Sections
  * Overview
  * Introduction Overview
  * Character Breakdown
* Create natural headings based on the topic
* Use short paragraphs
* Use varied sentence structure
* Avoid AI clichés
* Avoid phrases such as:

  * In today's world
  * Delve into
  * Dive deep
  * It is worth noting
  * In conclusion
  * Furthermore
  * Moreover

CONTENT QUALITY

* Answer the query immediately
* Add useful context
* Avoid filler content
* Minimum 1800 words
* Include unique insights where possible
* Make the article feel editorial rather than AI generated

HTML FORMAT

Use only:

<h2>
<h3>
<p>
<ul>
<li>
<table>
<tr>
<th>
<td>

CAST ARTICLE TEMPLATE

For keywords containing:

cast
actor
actress
characters

Generate:

* Cast overview table
* Main cast members
* Character guide
* Actor background information
* Notable previous roles
* Interesting facts
* FAQs

REVIEW ARTICLE TEMPLATE

For keywords containing:

review
ending explained

Generate:

* Quick verdict
* Plot summary
* What works
* What doesn't work
* Ending explained
* Final verdict
* FAQs

RELEASE DATE TEMPLATE

For keywords containing:

release date
season 2
season 3
renewed
cancelled

Generate:

* Latest update
* Release timeline
* Production status
* Returning cast
* What to expect
* FAQs

DOCUMENTARY TEMPLATE

For keywords containing:

documentary
true story

Generate:

* What the documentary is about
* Real story explained
* Key people involved
* Public reaction
* Where to watch
* FAQs

FAQ SECTION

Always include:

<h2>Frequently Asked Questions</h2>

Include 5 useful FAQs.

SEO REQUIREMENTS

Generate:

* Article Title
* SEO Title
* Meta Description
* Focus Keyword

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
