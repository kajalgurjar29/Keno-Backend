const p1 = [1, 2];
const p2 = [2, 3];
const p3 = [];
const p4 = [];

const getCombos = (type) => {
    if (type === "Quinella") {
        const union = Array.from(new Set([...p1, ...p2]));
        return union.length < 2 ? 0 : (union.length * (union.length - 1)) / 2;
    }
    const countDistinct = (current, remainingPos) => {
        if (remainingPos.length === 0) return 1;
        let sum = 0;
        const nextOptions = remainingPos[0];
        nextOptions.forEach(opt => {
            if (!current.includes(opt)) {
                sum += countDistinct([...current, opt], remainingPos.slice(1));
            }
        });
        return sum;
    };
    if (type === "Exacta") return countDistinct([], [p1, p2]);
    if (type === "Trifecta") return countDistinct([], [p1, p2, p3]);
    if (type === "FirstFour") return countDistinct([], [p1, p2, p3, p4]);
    return 0;
};

console.log("Quinella:", getCombos("Quinella"));
console.log("Exacta:", getCombos("Exacta"));
console.log("Trifecta:", getCombos("Trifecta"));
