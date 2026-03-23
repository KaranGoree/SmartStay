import Groq from "groq-sdk"

// ❗ IMPORTANT: Use NEXT_PUBLIC only if calling from client
// Otherwise keep it server-side only

const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY, // ✅ change here
})

export default groq