import requests

url = "https://discord.com/api/webhooks/1496651249855103057/6S2WUj8E0qXn6ah3eYKZ3H3dPVGWi2zW6UN5yvxI4Pm3vcRCGWnDCDicNPhbxKadg14L"

data = {
    "content": "Testing message to the shadow council who is both shadowy and council-y"
}


response = requests.post(url, json=data)