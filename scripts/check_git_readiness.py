import os

def check():
    large_files = []
    total_size = 0
    faculty_files_count = 0
    
    for r, d, fs in os.walk('.'):
        if any(x in r for x in ['node_modules', '.git', 'scratch']):
            continue
        for f in fs:
            full = os.path.join(r, f)
            if 'Faculty of' in full:
                faculty_files_count += 1
            try:
                sz = os.path.getsize(full)
                total_size += sz
                if sz > 50 * 1024 * 1024:
                    large_files.append((full, sz / (1024 * 1024)))
            except:
                pass
                
    print(f"Total files in Faculty folders: {faculty_files_count}")
    print(f"Total size of repository uncommitted files: {total_size / (1024*1024):.1f} MB")
    print(f"Files > 50MB ({len(large_files)}):")
    for path, sz in large_files:
        print(f"  - {path}: {sz:.1f} MB")

if __name__ == '__main__':
    check()
