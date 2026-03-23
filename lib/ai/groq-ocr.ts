export async function extractWithGroq(allText: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: `
You are an OCR data extractor.

Extract structured JSON:
{
  fullName: string,
  aadhaarNumber: string,
  marks: number,
  category: string,
  college: string
}

Return ONLY JSON.
          `,
        },
        {
          role: "user",
          content: allText,
        },
      ],
    }),
  })

  const data = await response.json()

  try {
    return JSON.parse(data.choices[0].message.content)
  } catch {
    return {}
  }
}