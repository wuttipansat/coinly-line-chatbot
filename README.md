# Coinly LINE Chatbot
Coinly LINE Chatbot is an AI-powered personal finance tracker for LINE. Users can send income or expense messages in Thai or English, and Coinly will automatically extract transaction details, save the data to Supabase, and provide simple financial summaries.

![Image alt](https://github.com/wuttipansat/coinly-line-chatbot/blob/e8e541ddb9aca769ab8c848b96827a7cd29f7ad6/snapshot1.jpg).
![Image alt](https://github.com/wuttipansat/coinly-line-chatbot/blob/e8e541ddb9aca769ab8c848b96827a7cd29f7ad6/snapshot2.jpg).

## Features
- Line Messaging API webhook integration
- AI transaction parsing from Thai or English text
- Extracts date, type, category, amount, and note
- Save transactions to Supabase
- Daily and monthly financial summaries
- Show recent transaction list
- FastAPI backend

## Tech Stack
- Python
- FastAPI
- Line Messaging API
- OpenAI-compatible API / OpenRouter
- LangChain
- Supabase
- Pydantic
- YAML
- Uvicorn

## Future Improvements
- More comprehensive LINE Flex Messaging
- Category-based analytics
- Budget tracking and alerts
- Improved AI parser accuracy
- Better error handling and logging
- Unit tests and integration tests
- Docker and CI/CD support

## Version
### v1.0.0 — First Release

Initial release includes LINE webhook integration, AI transaction parsing, confirmation cards, Supabase saving, and daily/monthly summaries.

## Author
Developed by Wuttipan Satienpaisan
