from pathlib import Path
from zipfile import ZipFile, ZIP_STORED

root=Path(__file__).resolve().parent.parent
with ZipFile(root/"downloads"/"mightora-har-offline.zip","w",compression=ZIP_STORED) as z:
    z.write(root/"downloads"/"har-analyser.html",arcname="har-analyser.html")
    z.write(root/"downloads"/"README-OFFLINE.txt",arcname="README.txt")
    z.write(root/"LICENSE",arcname="LICENSE.txt")
print("Offline ZIP updated")
