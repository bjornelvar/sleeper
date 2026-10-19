import json
import sys
from pathlib import Path

def extract_responses_from_har(har_path, output_path):
    # Read HAR file
    with open(har_path, 'r', encoding='utf-8') as f:
        har_data = json.load(f)

    entries = har_data.get("log", {}).get("entries", [])
    responses = []

    for entry in entries:
        response = entry.get("response", {})
        request = entry.get("request", {})
        content = response.get("content", {})

        # Store useful info
        responses.append({
            "url": request.get("url"),
            "status": response.get("status"),
            "statusText": response.get("statusText"),
            "mimeType": content.get("mimeType"),
            "text": content.get("text", ""),
        })

    # Dump all responses into a single JSON file
    with open(output_path, 'w', encoding='utf-8') as out:
        json.dump(responses, out, indent=2, ensure_ascii=False)

    print(f"✅ Extracted {len(responses)} responses to {output_path}")

if __name__ == "__main__":
    # if len(sys.argv) != 3:
    #     print("Usage: python parse_har.py input.har output.json")
    #     sys.exit(1)

    # har_file = Path(sys.argv[1])
    # output_file = Path(sys.argv[2])
    har_file_path = "/Users/bjossi/GitHub/sleeper/har_parsing/sleeper.com_Archive [25-10-12 14-54-27].har"
    output_file_path = "/Users/bjossi/GitHub/sleeper/har_parsing/sleeper_responses.json"
    har_file = Path(har_file_path)
    output_file = Path(output_file_path)

    extract_responses_from_har(har_file, output_file)


# 101.48