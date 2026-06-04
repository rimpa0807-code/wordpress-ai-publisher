export default async function handler(req, res) {
  try {
    const keyword = req.query.keyword;

    if (!keyword) {
      return res.status(400).json({
        error: "keyword parameter is required"
      });
    }

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
1. SEO-friendly title
2. Meta description
3. Long-form blog article (minimum 1200 words)

Return ONLY valid JSON:

{
  "title": "",
  "metaDescription": "",
  "content": ""
}
`
            },
            {
              role: "user",
              content: keyword
            }
          ],
          temperature: 0.7
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
          status: "publish"
        })
      }
    );

    const wpPost = await wpResponse.json();

    return res.status(200).json({
      success: true,
      keyword,
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
