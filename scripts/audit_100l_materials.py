import os
import sys
import json
import hashlib

EXCLUDE_DIRS = {'.git', 'node_modules', 'dist', '.vscode', '.windsurf', 'infra', '.github', 'prisma', '.gemini'}

def get_file_hash(filepath, block_size=65536):
    hasher = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            for block in iter(lambda: f.read(block_size), b''):
                hasher.update(block)
        return hasher.hexdigest()
    except Exception as e:
        return None

def scan_all():
    root = os.path.abspath(".")
    files_inventory = []
    
    for dirpath, dirnames, filenames in os.walk(root):
        # Exclude directories
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        
        rel_dir = os.path.relpath(dirpath, root)
        
        # We are interested in files in Faculty folders, data, articles, or any docs
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in {'.ts', '.js', '.json', '.html', '.css', '.md', '.log', '.env', '.yaml', '.yml', '.lock', '.ps1', '.sh', '.py'}:
                # Skip code files unless they are in data/ or faculty folders
                if not any(dirpath.lower().startswith(os.path.join(root, prefix).lower()) for prefix in [
                    "faculty of", "data", "articles", "jambpq"
                ]):
                    continue
            
            full_path = os.path.join(dirpath, f)
            try:
                size = os.path.getsize(full_path)
            except:
                size = 0
                
            files_inventory.append({
                "filename": f,
                "rel_path": os.path.relpath(full_path, root),
                "ext": ext,
                "size": size,
                "dir": rel_dir
            })
            
    print(f"Total discovered candidate files: {len(files_inventory)}")
    
    # Save preliminary list
    with open("scratch/materials_discovery_raw.json", "w", encoding="utf-8") as out:
        json.dump(files_inventory, out, indent=2)
        
    # Group by directory prefix
    prefix_counts = {}
    ext_counts = {}
    for item in files_inventory:
        top_folder = item["rel_path"].split(os.sep)[0]
        prefix_counts[top_folder] = prefix_counts.get(top_folder, 0) + 1
        ext_counts[item["ext"]] = ext_counts.get(item["ext"], 0) + 1
        
    print("\nFiles by top-level directory:")
    for k, v in sorted(prefix_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v} files")
        
    print("\nFiles by extension:")
    for k, v in sorted(ext_counts.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v} files")

if __name__ == "__main__":
    os.makedirs("scratch", exist_ok=True)
    scan_all()
