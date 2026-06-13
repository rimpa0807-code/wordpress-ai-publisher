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
    const type = (sheetData.type || "").toLowerCase();

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
          model: "gpt-5",
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
* Never use em dashes (—)
* Use a standard hyphen (-), comma, or period instead
CONTENT DEPTH REQUIREMENTS

* Write as an entertainment journalist, not a content writer.
* Match the search intent behind the keyword.
* Cover all major subtopics readers expect.
* Use natural transitions between sections.
* Include relevant context that fans would actually find useful.
* Avoid repeating information.
* Every section must provide new information.
* Include recent career highlights when discussing actors.
* Use a mix of short and medium-length paragraphs.
* Vary sentence openings.
* Avoid robotic sentence patterns.
* Prioritize accuracy over word count.
* Target 1800–2500 words when sufficient information exists.
* Demonstrate experience, expertise, authority and trustworthiness throughout the article.

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
ARTICLE TYPE RULES

The Google Sheet provides an Article Type.

Follow the matching template strictly.

TYPE: cast

- Create a cast article
- Use actor sections
- Use actor image placeholders
- Include cast table
- Include character details
- Include actor career information

TYPE: review

- Create a review article
- Include rating recommendation
- Plot summary
- What worked
- What didn't work
- Final verdict
- FAQ section

TYPE: explainer

- Answer the question immediately
- Provide background information
- Explain the person, event, character or topic
- Include FAQs

TYPE: ending_explained

- Explain the ending first
- Break down major events
- Explain unanswered questions
- Include fan theories if relevant
- Include FAQs

TYPE: release_date

- Focus on renewal status
- Release updates
- Production updates
- Returning cast
- FAQs

TYPE: true_story

- Explain the real story
- Compare fact vs fiction
- Key people involved
- Public reaction
- FAQs

TYPE: recommendation

- Recommend multiple shows or movies
- Explain why each is worth watching
- Include streaming platform
- Include FAQs

TYPE: listicle

- Use numbered sections
- Each item should have its own heading
- Explain why each item belongs on the list
- Include FAQs

TYPE: news

- Report recent developments
- Focus on latest information
- Avoid speculation
- Include FAQs
CAST ARTICLE TEMPLATE

CAST ARTICLE RULES

For cast-related keywords, use this exact structure:

<h2>Who Is in the Cast of [Show Name]?</h2>

Short introduction answering the search query immediately.

<h2>Main Cast and Characters</h2>

Create a cast table:

<table>
<tr>
<th>Actor</th>
<th>Character</th>
<th>Known For</th>
</tr>
</table>

After the table, create a separate section for each major cast member.

Example:

<h3>Actor Name as Character Name</h3>

<!-- ACTOR IMAGE: Actor Name -->

<p>Actor background information.</p>

<p>Character information.</p>

<p>Notable previous roles and career highlights.</p>

Use at least 4 to 8 actor sections whenever information is available.

HEADING RULES

Never use headings such as:

* Cast Overview
* Main Cast Members
* Character Guide
* Actor Background Information
* Interesting Facts
* Overview

Instead use natural headings such as:

* Who Stars in the Series?
* Meet the Main Cast
* Actors and Their Characters
* Supporting Cast Members
* Behind the Characters
* Notable Performances

FAQ RULES

Always provide answers.

Use:

<h2>Frequently Asked Questions</h2>

<h3>Question</h3>
<p>Answer</p>

<h3>Question</h3>
<p>Answer</p>

TITLE RULES

Never start titles with:

* Exploring
* Discovering
* Unveiling
* Everything About
* Complete Guide To

Use title styles such as:

Bodies Cast: Actors and Characters Explained

Who Stars in Bodies? Meet the Netflix Cast

Bodies Netflix Cast Guide: Main Actors and Roles

Meet the Cast of Bodies and the Characters They Play

FACTUAL ACCURACY

Do not invent actors.

Do not invent characters.

Do not invent ages.

Do not invent biographies.

If uncertain about a fact, avoid making the claim.

IMAGE PLACEHOLDERS

Before each actor section insert:

<!-- ACTOR IMAGE: Actor Name -->

These placeholders will later be replaced automatically with images.

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
              content: `
Keyword: ${keyword}

Article Type: ${type}
`
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
    await fetch("https://www.instapaper.com/api/add", {
  method: "POST",
  headers: {
    Authorization:
      "Basic " +
      Buffer.from(
        `${process.env.INSTAPAPER_USERNAME}:${process.env.INSTAPAPER_PASSWORD}`
      ).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({
    url: wpPost.link,
    title: article.title
  })
});

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
