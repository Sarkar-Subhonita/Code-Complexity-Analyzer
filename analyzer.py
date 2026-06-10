import re

def analyze_complexity(code: str) -> dict:
    lines = code.strip().split('\n')
    
    loop_count = 0
    has_recursion = False
    has_binary_search = False
    has_nested_loop = False
    has_list = 'append' in code or '=[]' in code
    has_dict = '{}' in code or 'dict' in code
    has_2d = '[[' in code
    problematic_lines = []

    # Loops count karo
    for i, line in enumerate(lines):
        if re.search(r'\bfor\b|\bwhile\b', line):
            loop_count += 1
            # Nested loop check — agli line mein bhi loop hai?
            if i + 1 < len(lines):
                if re.search(r'\bfor\b|\bwhile\b', lines[i+1]):
                    has_nested_loop = True
                    problematic_lines.append(i + 1)
                    problematic_lines.append(i + 2)

    # Recursion check
    func_match = re.search(r'def\s+(\w+)', code)
    if func_match:
        func_name = func_match.group(1)
        if code.count(func_name) > 1:
            has_recursion = True
    
    # Binary search pattern
    if 'mid' in code and ('left' in code or 'low' in code):
        has_binary_search = True

    # Complexity + explanation + suggestion decide karo
    if has_binary_search:
        time_complexity = "O(log n)"
        explanation = (
            "Tera code binary search pattern follow kar raha hai. "
            "Har step mein input half ho jaata hai, isliye O(log n) hai."
        )
        suggestion = "Yeh already optimal hai! Binary search se better nahi ho sakta sorted array ke liye."
        code_example = """# Tera current approach already optimal hai:
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1"""

    elif has_nested_loop:
        time_complexity = "O(n²)"
        explanation = (
            "Tera code mein nested loops hain — ek loop ke andar doosra loop. "
            "Iska matlab n elements ke liye n×n = n² operations honge. "
            "Jaise 1000 elements pe 10,00,000 operations!"
        )
        suggestion = (
            "Nested loops ko aksar HashMap (dictionary) se O(n) mein convert kar sakte hain. "
            "Neeche Two Sum ka example dekh:"
        )
        code_example = """# Slow way - O(n²) nested loop:
for i in range(len(arr)):
    for j in range(i+1, len(arr)):
        if arr[i] + arr[j] == target:
            return [i, j]

# Fast way - O(n) HashMap use karke:
seen = {}
for i, num in enumerate(arr):
    complement = target - num
    if complement in seen:
        return [seen[complement], i]
    seen[num] = i"""

    elif has_recursion and loop_count >= 1:
        time_complexity = "O(n log n)"
        explanation = (
            "Tera code recursion aur loop dono use kar raha hai. "
            "Yeh Merge Sort ya Quick Sort jaisa pattern hai — O(n log n)."
        )
        suggestion = "Yeh already efficient hai sorting ke liye. Agar possible ho toh Python ka built-in sort() use karo — woh bhi O(n log n) hai but internally optimized hai."
        code_example = """# Python built-in sort — O(n log n) but faster in practice:
arr.sort()  # In-place
# ya
sorted_arr = sorted(arr)  # Naya list"""

    elif has_recursion:
        time_complexity = "O(n)"
        explanation = (
            "Tera code recursion use kar raha hai — function khud ko call kar raha hai. "
            "Har call ek element process karta hai, toh O(n) hai."
        )
        suggestion = "Recursion stack overflow de sakta hai bade inputs pe. Iterative approach ya tail recursion try karo."
        code_example = """# Recursion (stack overflow risk bade n pe):
def factorial(n):
    if n == 0:
        return 1
    return n * factorial(n-1)

# Better — Iterative approach:
def factorial(n):
    result = 1
    for i in range(1, n+1):
        result *= i
    return result"""

    elif loop_count == 0:
        time_complexity = "O(1)"
        explanation = (
            "Tera code mein koi loop nahi hai. "
            "Input kitna bhi bada ho, operations same rehte hain — yeh best possible complexity hai!"
        )
        suggestion = "Kuch nahi karna — yeh already optimal hai!"
        code_example = """# O(1) ka example — direct calculation:
def get_first(arr):
    return arr[0]  # Hamesha ek hi operation"""

    elif loop_count == 1:
        time_complexity = "O(n)"
        explanation = (
            "Tera code mein ek loop hai jo poore input pe chalta hai. "
            "1000 elements pe 1000 operations — linear growth."
        )
        suggestion = "Agar koi specific element dhundh raha hai toh pehle sort karke binary search use karo — O(log n) ho jaayega."
        code_example = """# Slow - O(n) linear search:
for item in arr:
    if item == target:
        return True

# Fast - O(log n) binary search (sorted array pe):
import bisect
index = bisect.bisect_left(arr, target)
return index < len(arr) and arr[index] == target"""

    else:
        time_complexity = f"O(n^{loop_count})"
        explanation = f"Tera code mein {loop_count} loops hain. Yeh bahut slow ho sakta hai bade inputs pe."
        suggestion = "Itne nested loops ko reduce karne ki koshish karo — HashMap ya sorting use karke."
        code_example = "# Apne specific use case ke hisaab se restructure karo."

    # Space complexity decide karo
    if has_2d:
        space_complexity = "O(n²)"
    elif has_list or has_dict:
        space_complexity = "O(n)"
    else:
        space_complexity = "O(1)"
    return {
        "time_complexity": time_complexity,
        "explanation": explanation,
        "suggestion": suggestion,
        "code_example": code_example,
        "space_complexity": space_complexity,
        "loops_found": loop_count,
        "problematic_lines": problematic_lines,
        "details": {
            "loops_found": loop_count,
            "recursion_detected": has_recursion,
            "nested_loop_detected": has_nested_loop,
            "binary_search_detected": has_binary_search
        }
    }