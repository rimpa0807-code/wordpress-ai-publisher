import OpenAI from "openai";
import axios from "axios";

export default async function handler(req, res) {
  res.status(200).json({
    success: true,
    message: "AI Publisher Connected"
  });
}
