import pymongo
from pymongo import MongoClient

cluster = MongoClient("mongodb+srv://emojibluefaith:rickmwas@cluster0.osrfs.mongodb.net/?appName=Cluster0")

db = cluster["Recruitment_system"]
collection = db["users"]

post1 = {
    "name": "Faith Jebet",
    "email": "faithjebetkiprono@gmail.com",
    "role": "admin"
}
post2 = {
    "name": "John Doe",
    "email": "johndoe@example.com",
    "role": "user"
}

results = collection.find({"name": "Faith Jebet"})
for result in results:
    print(result["_id"])