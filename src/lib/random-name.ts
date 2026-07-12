const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Kabir", "Aryan", "Dhruv", "Karan", "Nikhil", "Rahul",
  "Saanvi", "Ananya", "Diya", "Isha", "Kavya", "Meera", "Pooja", "Riya",
  "Shreya", "Neha", "Priya", "Anjali", "Sneha", "Tanvi", "Vaishali", "Kiran",
  "Manoj", "Suresh", "Ramesh", "Deepak", "Vikram", "Ashok", "Sanjay", "Rakesh",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Mehta", "Shah",
  "Agarwal", "Jain", "Rao", "Reddy", "Nair", "Iyer", "Chauhan", "Malhotra",
  "Kapoor", "Bhatt", "Joshi", "Desai", "Pandey", "Mishra", "Yadav", "Saxena",
];

export function generateRandomCustomerName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
