// A larger, varied question bank for testing exam generation and AI question writing.
// Run with `npm run db:seed-bank`. Idempotent: adds only what is missing; never deletes
// anything and never changes an existing account's password.
//
// Every question follows the review rules: shared questions are approved by another
// instructor in the author's major; private ones by their author.
import { PrismaClient, type Major } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run from a production server. Run it from a developer machine.");
  process.exit(1);
}

const prisma = new PrismaClient();

const instructors = {
  lina: { email: "lina.nasser@example.com", name: "Dr. Lina Nasser", major: "MATHEMATICS" as Major, courses: ["Mathematics 101"] },
  sara: { email: "sara.haddad@example.com", name: "Dr. Sara Haddad", major: "MATHEMATICS" as Major, courses: ["Mathematics 101"] },
  omar: { email: "omar.khalil@example.com", name: "Dr. Omar Khalil", major: "COMPUTER_SCIENCE" as Major, courses: ["Introduction to Programming", "Data Structures"] },
  rami: { email: "rami.saad@example.com", name: "Dr. Rami Saad", major: "COMPUTER_SCIENCE" as Major, courses: ["Introduction to Programming", "Data Structures"] },
};
type Who = keyof typeof instructors;
// The same-major colleague who approves each author's shared questions.
const reviewerOf: Record<Who, Who> = { lina: "sara", sara: "lina", omar: "rami", rami: "omar" };

const courses: { name: string; description: string; owner: Who; chapters: string[]; authors: [Who, Who] }[] = [
  { name: "Mathematics 101", description: "Foundations of algebra and introductory calculus.", owner: "lina", chapters: ["Algebra", "Functions", "Limits", "Derivatives"], authors: ["lina", "sara"] },
  { name: "Introduction to Programming", description: "Programming fundamentals using Python.", owner: "omar", chapters: ["Variables and Types", "Control Flow", "Functions"], authors: ["omar", "rami"] },
  { name: "Data Structures", description: "Arrays, linked lists, stacks, queues, trees, sorting and searching.", owner: "rami", chapters: ["Arrays and Lists", "Stacks and Queues", "Trees", "Sorting and Searching"], authors: ["rami", "omar"] },
];

// [course, chapter, difficulty 1-5, minutes, question, answer, options?]
type Q = [string, string, number, number, string, string, string[]?];
const M = "Mathematics 101";
const P = "Introduction to Programming";
const D = "Data Structures";

const bank: Q[] = [
  // ---- Mathematics 101 / Algebra ----
  [M, "Algebra", 1, 2, "Solve 3x - 7 = 11.", "x = 6", ["x = 4", "x = 6", "x = 3", "x = 18"]],
  [M, "Algebra", 1, 2, "Which number is equal to 2^5?", "32", ["10", "25", "32", "64"]],
  [M, "Algebra", 2, 3, "Simplify (2x^3)(3x^4).", "6x^7", ["5x^7", "6x^7", "6x^12", "5x^12"]],
  [M, "Algebra", 2, 4, "Solve x^2 - 9x + 20 = 0.", "x = 4 or x = 5 (since x^2 - 9x + 20 = (x - 4)(x - 5))."],
  [M, "Algebra", 3, 5, "Expand (x - 2)^3.", "x^3 - 6x^2 + 12x - 8"],
  [M, "Algebra", 3, 6, "Solve the inequality |2x - 3| < 5.", "-5 < 2x - 3 < 5, so -2 < 2x < 8, giving -1 < x < 4."],
  [M, "Algebra", 3, 6, "Solve the system 2x + 3y = 12 and x - y = 1.", "From x = y + 1: 2(y + 1) + 3y = 12, so y = 2 and x = 3."],
  [M, "Algebra", 4, 8, "For which values of k does x^2 + kx + 9 = 0 have exactly one real solution?", "The discriminant k^2 - 36 must be 0, so k = 6 or k = -6."],
  [M, "Algebra", 4, 10, "Find all real x with sqrt(x + 7) = x - 5.", "Squaring gives x^2 - 11x + 18 = 0, so x = 9 or x = 2. Only x = 9 works (sqrt(16) = 4 = 9 - 5); x = 2 is extraneous."],
  [M, "Algebra", 5, 15, "Prove that a^2 + b^2 >= 2ab for all real numbers a and b, and state when equality holds.", "(a - b)^2 >= 0 expands to a^2 - 2ab + b^2 >= 0, i.e. a^2 + b^2 >= 2ab. Equality holds exactly when a = b."],
  // ---- Mathematics 101 / Functions ----
  [M, "Functions", 1, 2, "If f(x) = x^2 + 1, what is f(-3)?", "10", ["-8", "8", "10", "-10"]],
  [M, "Functions", 2, 3, "Which of these functions is odd?", "f(x) = x^3", ["f(x) = x^2", "f(x) = x^3", "f(x) = |x|", "f(x) = cos x"]],
  [M, "Functions", 2, 4, "What is the domain of f(x) = 1 / (x - 4)?", "All real numbers except x = 4."],
  [M, "Functions", 2, 4, "Let f(x) = 2x + 3 and g(x) = x^2. Find (f o g)(x) and (g o f)(x).", "(f o g)(x) = 2x^2 + 3 and (g o f)(x) = (2x + 3)^2 = 4x^2 + 12x + 9."],
  [M, "Functions", 3, 5, "Let f(x) = log base 2 of x. Compute f(32) - f(1/4).", "f(32) = 5 and f(1/4) = -2, so the difference is 7."],
  [M, "Functions", 3, 6, "Find the inverse of f(x) = (3x - 1) / 2.", "Solve y = (3x - 1)/2 for x: x = (2y + 1)/3, so f^-1(x) = (2x + 1)/3."],
  [M, "Functions", 3, 6, "Find the vertex and the range of y = x^2 - 6x + 5.", "y = (x - 3)^2 - 4, so the vertex is (3, -4) and the range is y >= -4."],
  [M, "Functions", 4, 8, "Is f(x) = x^3 - 3x one-to-one on the real numbers? Justify your answer.", "No. f(0) = 0 and f(sqrt(3)) = 3 sqrt(3) - 3 sqrt(3) = 0, so two different inputs give the same output."],
  [M, "Functions", 4, 10, "Find the range of f(x) = (x + 1) / (x - 2), x != 2.", "Solving y = (x + 1)/(x - 2) gives x = (2y + 1)/(y - 1), defined for every y except 1. The range is all real numbers except 1."],
  [M, "Functions", 5, 15, "Show that f(x) = (e^x - e^-x) / 2 is odd and increasing, and find its inverse.", "f(-x) = -f(x), so f is odd; f'(x) = (e^x + e^-x)/2 > 0, so f is increasing. Solving y = f(x) gives e^x = y + sqrt(y^2 + 1), so f^-1(y) = ln(y + sqrt(y^2 + 1))."],
  // ---- Mathematics 101 / Limits ----
  [M, "Limits", 1, 2, "Evaluate the limit of 3x + 1 as x approaches 2.", "7", ["5", "6", "7", "8"]],
  [M, "Limits", 2, 3, "What is the limit of 1 / x^2 as x approaches 0?", "+infinity", ["0", "1", "+infinity", "-infinity"]],
  [M, "Limits", 2, 4, "Evaluate the limit of (x^2 - 4) / (x + 2) as x approaches -2.", "(x^2 - 4)/(x + 2) = x - 2 for x != -2, so the limit is -4."],
  [M, "Limits", 2, 4, "Evaluate the limit of (3x^2 + 1) / (5x^2 - x) as x approaches infinity.", "Divide top and bottom by x^2: the limit is 3/5."],
  [M, "Limits", 3, 5, "Evaluate the limit of sin(3x) / x as x approaches 0.", "3", ["0", "1", "3", "1/3"]],
  [M, "Limits", 3, 6, "Evaluate the limit of (sqrt(x + 4) - 2) / x as x approaches 0.", "Multiply by the conjugate: 1/(sqrt(x + 4) + 2), which tends to 1/4."],
  [M, "Limits", 3, 6, "Evaluate the limit of x ln(x) as x approaches 0 from the right.", "Write it as ln(x)/(1/x) and use L'Hopital: (1/x)/(-1/x^2) = -x, which tends to 0."],
  [M, "Limits", 4, 8, "Evaluate the limit of (1 + 2/x)^x as x approaches infinity.", "e^2"],
  [M, "Limits", 4, 10, "Let f(x) = x^2 + a for x < 2 and f(x) = 3x - 1 for x >= 2. Find a so that f is continuous at x = 2.", "Both sides must equal f(2) = 5: 4 + a = 5, so a = 1."],
  [M, "Limits", 5, 15, "Use the epsilon-delta definition to prove that the limit of 2x - 1 as x approaches 3 is 5.", "Given epsilon > 0, choose delta = epsilon/2. If 0 < |x - 3| < delta, then |(2x - 1) - 5| = 2|x - 3| < 2 delta = epsilon."],
  // ---- Mathematics 101 / Derivatives ----
  [M, "Derivatives", 1, 2, "What is the derivative of x^4?", "4x^3", ["x^3", "4x^3", "4x^4", "3x^4"]],
  [M, "Derivatives", 2, 3, "If f(x) = 5x^3 - 2x, find f'(1).", "f'(x) = 15x^2 - 2, so f'(1) = 13."],
  [M, "Derivatives", 2, 4, "Differentiate x^2 sin(x).", "2x sin(x) + x^2 cos(x) (product rule)."],
  [M, "Derivatives", 2, 4, "Differentiate e^(3x) ln(x).", "3e^(3x) ln(x) + e^(3x)/x (product and chain rules)."],
  [M, "Derivatives", 3, 5, "What is the derivative of sin(x^2)?", "2x cos(x^2)", ["cos(x^2)", "2x cos(x^2)", "2 sin(x) cos(x)", "-2x cos(x^2)"]],
  [M, "Derivatives", 3, 6, "Differentiate (x^2 + 1) / (x - 1).", "Quotient rule: (2x(x - 1) - (x^2 + 1)) / (x - 1)^2 = (x^2 - 2x - 1) / (x - 1)^2."],
  [M, "Derivatives", 3, 6, "Find the equation of the tangent line to y = x^3 at x = 2.", "y' = 3x^2 = 12 at x = 2 and the point is (2, 8), so y = 12x - 16."],
  [M, "Derivatives", 4, 8, "The circle x^2 + y^2 = 25 passes through (3, 4). Find dy/dx there.", "2x + 2y y' = 0, so y' = -x/y = -3/4."],
  [M, "Derivatives", 4, 10, "Find the local maximum and minimum of f(x) = x^3 - 3x^2 - 9x + 2.", "f'(x) = 3(x - 3)(x + 1). Local maximum f(-1) = 7; local minimum f(3) = -25."],
  [M, "Derivatives", 5, 15, "A rectangle has its base on the diameter of a semicircle of radius 1 and its top corners on the arc. Find its largest possible area.", "With corners at (+-x, sqrt(1 - x^2)), A = 2x sqrt(1 - x^2). A' = 0 gives x = 1/sqrt(2), so the maximum area is 1 (width sqrt(2), height sqrt(2)/2)."],

  // ---- Introduction to Programming / Variables and Types ----
  [P, "Variables and Types", 1, 2, "In Python, what is type(3.0)?", "float", ["int", "float", "str", "decimal"]],
  [P, "Variables and Types", 1, 2, "In Python 3, what is 7 // 2?", "3", ["3", "3.5", "4", "1"]],
  [P, "Variables and Types", 1, 2, "What is len(\"hello world\") in Python?", "11", ["10", "11", "12", "5"]],
  [P, "Variables and Types", 2, 3, "What does \"ab\" * 3 evaluate to in Python?", "ababab", ["ababab", "ab3", "An error", "aaabbb"]],
  [P, "Variables and Types", 2, 3, "What is printed?\nx = 5\ny = x\nx = 7\nprint(y)", "5. Assigning a new value to x doesn't change y, which still refers to 5."],
  [P, "Variables and Types", 2, 4, "Which of these Python types is immutable?", "tuple", ["list", "dict", "set", "tuple"]],
  [P, "Variables and Types", 3, 5, "What does int(\"42\") + float(\"0.5\") evaluate to, and what is its type?", "42.5, of type float (an int plus a float gives a float)."],
  [P, "Variables and Types", 3, 6, "Explain the difference between == and is in Python, with an example.", "== compares values; is compares identity (the same object). [1] == [1] is True, but [1] is [1] is False because they are two different lists."],
  // ---- Introduction to Programming / Control Flow ----
  [P, "Control Flow", 1, 2, "How many lines does `for i in range(5): print(i)` print?", "5", ["4", "5", "6", "0"]],
  [P, "Control Flow", 2, 3, "Which Python keyword skips to the next iteration of a loop?", "continue", ["break", "pass", "continue", "next"]],
  [P, "Control Flow", 2, 3, "What does this print?\nn = 7\nprint(\"odd\" if n % 2 else \"even\")", "odd (7 % 2 is 1, which is truthy)."],
  [P, "Control Flow", 2, 4, "What does this print?\nfor i in range(1, 10, 3):\n    print(i, end=\" \")", "1 4 7"],
  [P, "Control Flow", 3, 6, "Write a loop that prints the sum of the even numbers from 1 to 100.", "total = 0\nfor n in range(2, 101, 2):\n    total += n\nprint(total)  # 2550"],
  [P, "Control Flow", 3, 6, "What does this print?\nx = 10\nwhile x > 1:\n    x = x // 2\n    print(x)", "5, then 2, then 1, each on its own line."],
  [P, "Control Flow", 4, 8, "How many times does the print run?\nfor i in range(4):\n    for j in range(i):\n        print(i, j)", "0 + 1 + 2 + 3 = 6 times."],
  [P, "Control Flow", 4, 10, "Write a program that prints the numbers 1 to 15, but prints Fizz for multiples of 3, Buzz for multiples of 5 and FizzBuzz for multiples of both.", "for n in range(1, 16):\n    if n % 15 == 0: print(\"FizzBuzz\")\n    elif n % 3 == 0: print(\"Fizz\")\n    elif n % 5 == 0: print(\"Buzz\")\n    else: print(n)"],
  // ---- Introduction to Programming / Functions ----
  [P, "Functions", 1, 2, "Which keyword defines a function in Python?", "def", ["func", "def", "function", "lambda"]],
  [P, "Functions", 2, 3, "What does f(3) return?\ndef f(x):\n    return x * x + 1", "10"],
  [P, "Functions", 2, 4, "What is printed?\ndef g(a, b=2):\n    return a * b\nprint(g(4), g(4, 3))", "8 12 (b defaults to 2 in the first call)."],
  [P, "Functions", 3, 5, "What is the value of (lambda x, y: x - y)(10, 4)?", "6", ["6", "-6", "14", "An error"]],
  [P, "Functions", 3, 5, "What does h(1, 2, 3) return?\ndef h(*args):\n    return sum(args)", "6. *args collects the arguments into a tuple (1, 2, 3)."],
  [P, "Functions", 3, 6, "Write a function is_prime(n) that returns True when n is a prime number.", "def is_prime(n):\n    if n < 2: return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0: return False\n        i += 1\n    return True"],
  [P, "Functions", 4, 8, "What is printed, and why?\nx = 5\ndef f():\n    x = 10\nf()\nprint(x)", "5. The assignment inside f creates a new local x; the global x is unchanged."],
  [P, "Functions", 4, 10, "Write a recursive function factorial(n) and give factorial(5).", "def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)\nfactorial(5) is 120."],

  // ---- Data Structures / Arrays and Lists ----
  [D, "Arrays and Lists", 1, 2, "What is the time complexity of reading an array element by its index?", "O(1)", ["O(1)", "O(log n)", "O(n)", "O(n log n)"]],
  [D, "Arrays and Lists", 2, 3, "What is a after this code?\na = [1, 2, 3]\nb = a\nb.append(4)", "[1, 2, 3, 4], because a and b refer to the same list."],
  [D, "Arrays and Lists", 2, 4, "How long does inserting at the front of a Python list of n elements take?", "O(n)", ["O(1)", "O(log n)", "O(n)", "O(n^2)"]],
  [D, "Arrays and Lists", 3, 6, "Describe how to reverse a singly linked list, and give its time and space complexity.", "Walk the list keeping prev, curr and next; point each curr.next at prev, then advance. O(n) time and O(1) extra space."],
  [D, "Arrays and Lists", 3, 8, "Given a sorted array, remove the duplicates in place and return the new length. What does [1, 1, 2, 2, 3] give?", "Use two pointers: a write index advances only when a new value appears. The result is 3, with the array starting [1, 2, 3]."],
  [D, "Arrays and Lists", 4, 10, "How can you find the middle node of a singly linked list in one pass?", "Move a slow pointer one step and a fast pointer two steps at a time; when fast reaches the end, slow is at the middle. O(n) time, O(1) space."],
  // ---- Data Structures / Stacks and Queues ----
  [D, "Stacks and Queues", 1, 2, "In what order does a stack remove elements?", "LIFO", ["FIFO", "LIFO", "Random", "By priority"]],
  [D, "Stacks and Queues", 2, 3, "Which data structure does breadth-first search use?", "Queue", ["Stack", "Queue", "Heap", "Hash table"]],
  [D, "Stacks and Queues", 2, 4, "Push 1, 2, 3 onto an empty stack, pop once, push 4, then pop twice. What is left?", "Only 1 (pops remove 3, then 4, then 2)."],
  [D, "Stacks and Queues", 3, 6, "Evaluate the postfix expression 5 1 2 + 4 * + 3 -.", "1 + 2 = 3; 3 * 4 = 12; 5 + 12 = 17; 17 - 3 = 14."],
  [D, "Stacks and Queues", 3, 6, "Using a stack, explain why \"{[()]}\" is balanced but \"([)]\" is not.", "Push each opening bracket and pop when a closing one arrives; it must match the top. In \"([)]\" the ) arrives while [ is on top, so it fails."],
  [D, "Stacks and Queues", 4, 10, "How can you implement a queue with two stacks, and what does each operation cost?", "Enqueue pushes onto stack A. Dequeue pops from stack B, first moving everything from A to B if B is empty. Each element moves once, so both are O(1) amortized."],
  // ---- Data Structures / Trees ----
  [D, "Trees", 1, 2, "What is the largest number of children a node in a binary tree can have?", "2", ["1", "2", "3", "Unlimited"]],
  [D, "Trees", 2, 4, "Insert 5, 3, 8, 1, 4 into an empty binary search tree. What is its in-order traversal?", "1 3 4 5 8"],
  [D, "Trees", 3, 6, "A tree has root A, whose left child B has children D and E, and whose right child is C. What is its pre-order traversal?", "A B D E C"],
  [D, "Trees", 3, 6, "What is the height (in edges) of a complete binary tree with 15 nodes?", "3. 15 = 2^4 - 1 nodes fill 4 levels, which is 3 edges from root to leaf."],
  [D, "Trees", 4, 10, "How do you delete a node with two children from a binary search tree?", "Replace its value with its in-order successor (the smallest value in its right subtree), then delete that successor, which has at most one child."],
  [D, "Trees", 5, 15, "Prove that a binary tree with n nodes has exactly n + 1 null child pointers.", "There are 2n child pointers in total. Every node except the root is pointed to by exactly one of them, so n - 1 are used and 2n - (n - 1) = n + 1 are null."],
  // ---- Data Structures / Sorting and Searching ----
  [D, "Sorting and Searching", 1, 2, "What does binary search require of its input?", "Sorted data", ["Sorted data", "A linked list", "A hash table", "Unique values"]],
  [D, "Sorting and Searching", 2, 3, "Which of these sorting algorithms is stable?", "Merge sort", ["Merge sort", "Quicksort (typical)", "Heap sort", "Selection sort"]],
  [D, "Sorting and Searching", 2, 4, "What is the worst-case time complexity of quicksort?", "O(n^2)", ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"]],
  [D, "Sorting and Searching", 3, 6, "What is the largest number of comparisons binary search needs on a sorted array of 1000 elements?", "10, since 2^10 = 1024 >= 1000."],
  [D, "Sorting and Searching", 3, 8, "Show the array after one pass of bubble sort on [5, 1, 4, 2, 8].", "[1, 4, 2, 5, 8]"],
  [D, "Sorting and Searching", 4, 10, "Write the recurrence for merge sort and solve it.", "T(n) = 2T(n/2) + O(n), which solves to O(n log n) (log n levels, each doing O(n) work)."],
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  // Instructors: use existing accounts; create a missing one only if SEED_PASSWORD is set.
  const ids = {} as Record<Who, string>;
  const password = process.env.SEED_PASSWORD ?? "";
  for (const [key, info] of Object.entries(instructors) as [Who, (typeof instructors)[Who]][]) {
    const found = await prisma.user.findUnique({ where: { email: info.email }, select: { id: true, major: true } });
    if (found) {
      // Make sure the major is set so the same-major review rule works.
      if (found.major !== info.major) await prisma.user.update({ where: { id: found.id }, data: { major: info.major } });
      ids[key] = found.id;
      continue;
    }
    if (password.length < 8) throw new Error(`${info.email} doesn't exist; set SEED_PASSWORD (8+ characters) to create it.`);
    const created = await prisma.user.create({
      data: {
        email: info.email,
        name: info.name,
        role: "INSTRUCTOR",
        passwordHash: await bcrypt.hash(password, 10),
        major: info.major,
        degree: "DOCTORATE",
        university: "Lebanese American University",
        courses: info.courses,
      },
    });
    ids[key] = created.id;
    console.log(`Created instructor ${info.email}`);
  }

  // Courses and chapters (new chapters go after the existing ones).
  const chapterIds = new Map<string, { curriculumId: string; chapterId: string }>();
  for (const c of courses) {
    const course =
      (await prisma.curriculum.findFirst({ where: { name: { equals: c.name, mode: "insensitive" } } })) ??
      (await prisma.curriculum.create({ data: { name: c.name, description: c.description, createdById: ids[c.owner] } }));
    for (const title of c.chapters) {
      let chapter = await prisma.chapter.findFirst({ where: { curriculumId: course.id, title } });
      if (!chapter) {
        const last = await prisma.chapter.aggregate({ where: { curriculumId: course.id }, _max: { orderIndex: true } });
        chapter = await prisma.chapter.create({ data: { curriculumId: course.id, title, orderIndex: (last._max.orderIndex ?? 0) + 1 } });
      }
      chapterIds.set(`${c.name}/${title}`, { curriculumId: course.id, chapterId: chapter.id });
    }
  }

  let created = 0;
  for (const [i, [courseName, chapterTitle, difficulty, minutes, content, answer, options]] of bank.entries()) {
    const location = chapterIds.get(`${courseName}/${chapterTitle}`);
    if (!location) throw new Error(`Unknown chapter ${courseName}/${chapterTitle}`);
    if (options && !options.includes(answer)) throw new Error(`Answer not in options: ${content}`);

    const course = courses.find((c) => c.name === courseName)!;
    const owner = course.authors[i % 2];
    if (await prisma.question.findFirst({ where: { content, curriculumId: location.curriculumId } })) continue;

    // A realistic mix: mostly shared and approved, some private, a few still waiting for review.
    const visibility = i % 7 === 3 ? "PRIVATE" : "SHARED";
    const status = visibility === "SHARED" && i % 11 === 5 ? "PENDING" : "APPROVED";
    const approver = visibility === "PRIVATE" ? owner : reviewerOf[owner];
    const used = status === "APPROVED" && i % 4 === 0;

    await prisma.question.create({
      data: {
        ...location,
        content,
        options: options ?? undefined,
        answer,
        difficulty,
        estimatedTimeMinutes: minutes,
        source: "MANUAL",
        createdById: ids[owner],
        visibility,
        status,
        approvedById: status === "APPROVED" ? ids[approver] : null,
        approvedAt: status === "APPROVED" ? daysAgo(30 + (i % 40)) : null,
        timesUsed: used ? 1 + (i % 3) : 0,
        lastUsedAt: used ? daysAgo(10 + ((i * 7) % 80)) : null,
      },
    });
    created++;
  }

  const counts = await prisma.question.groupBy({ by: ["status"], _count: true });
  console.log(`Question bank: ${created} new question(s) added (${bank.length} in the set).`);
  console.log(`All questions now: ${counts.map((c) => `${c._count} ${c.status.toLowerCase()}`).join(", ")}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
