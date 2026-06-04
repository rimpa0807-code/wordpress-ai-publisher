export default async function handler(req, res) {
  try {

    // Fetch keyword from Google Sheet
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
          messages: [
            {
              role: "system",
              content: `
You are an expert SEO content writer.

Generate:

1. SEO Title
2. Meta Description
3. Long Form Article (1500+ words)

Return ONLY valid JSON:

{
  "title":"",
  "metaDescription":"",
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

    const article = JSON.parse(
      openaiData.choices[0].message.content
    );

    const auth = Buffer.from(
      `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
    ).toString("base64");

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
          slug: slug.replace("/", ""),
          status: "publish"
        })
      }
    );

    const wpPost = await wpResponse.json();

    return res.status(200).json({
      success: true,
      keyword,
      slug,
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
