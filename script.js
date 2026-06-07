document.getElementById("analyze-btn").addEventListener("click", function() {
    // Step 1: textarea se code lo
    let code = document.getElementById("code-input").value;
        
        // Step 2: console mein print karo check karne ke liye
        fetch("http://127.0.0.1:8000/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                code: code,
                language: "python"
        })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById("result").innerHTML = `
            <h3>Time Complexity: ${data.time_complexity}</h3>
            <p><b>Explanation:</b> ${data.explanation}</p>
            <p><b>Suggestion:</b> ${data.suggestion}</p>
            <pre>${data.code_example}</pre>
        `;
    })
    .catch(error => {
        document.getElementById("result").innerHTML = "Error: " + error;
    });
});