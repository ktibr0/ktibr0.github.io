      gridsize = 4;
      numbersize = gridsize - 1;
      document.getElementById("size").value = numbersize;

      const loadGame = document.getElementById("game-area");

      // Clear old saved game if it contains English text (from older version)
      const savedGame = localStorage.getItem("loadgame");
      if (savedGame !== null) {
        // Check for old English button texts or old structure
        if (savedGame.includes("Mistakes") || savedGame.includes("Invite") ||
            savedGame.includes("better luck next time") ||
            savedGame.includes("loadgame")) {
          localStorage.removeItem("loadgame");
          generate();
        } else {
          loadGame.innerHTML = savedGame;
          numbersize = document.querySelectorAll(".hanswer").length;
          gridsize = numbersize + 1;
          document.getElementById("size").value = numbersize;
        }
      } else {
        generate();
      }

      // Generate new puzzle
      function generate() {
        const grid = document.getElementById("grid");
        grid.innerHTML = "";
        for (let i = 0; i < gridsize * gridsize; i++) {
          const cell = document.createElement("div");
          cell.classList.add("cell");
          grid.appendChild(cell);
        }

        for (let i = 0; i <= numbersize - 1; i++) {
          let prevr, easyrow;
          if (!easyrow && Math.random() < 0.3) {
            easyrow = true;
          }
          for (let j = 0; j <= numbersize - 1; j++) {
            let r = Math.floor(Math.random() * 9) + 1;
            if (r === prevr) {
              r = Math.floor(Math.random() * 9) + 1;
            }
            prevr = r;
            let index = i * gridsize + j;
            let cell = grid.children[index];

            cell.textContent = r;
            cell.classList.add("number");
            if (Math.random() < (easyrow ? 0.1 : 0.5)) {
              cell.classList.add("circle", "solution");
            }
          }
          easyrow = false;
        }

        // Prefill corners for larger grids
        const corners = [
          [1, 1],
          [1, gridsize - 3],
          [gridsize - 3, 1],
          [gridsize - 3, gridsize - 3],
        ];

        for (let i = 0; i < corners.length; i++) {
          const [row, col] = corners[i];
          const cellIndex = row * gridsize + col;
          const cornerCell = grid.children[cellIndex];
          cornerCell.classList.add("circle", "solution");
        }

        // Calculate row sums (right column)
        for (let i = 0; i <= numbersize - 1; i++) {
          let sum = 0;
          for (let j = 0; j <= numbersize - 1; j++) {
            let index = i * gridsize + j;
            let cell = grid.children[index];
            if (cell.classList.contains("circle")) {
              sum += parseInt(cell.textContent);
            }
          }
          let index = i * gridsize + (gridsize - 1);
          let cell = grid.children[index];
          cell.textContent = sum;
          cell.classList.add("hanswer");
        }

        // Calculate column sums (bottom row)
        for (let j = 0; j <= numbersize - 1; j++) {
          let sum = 0;
          for (let i = 0; i <= numbersize - 1; i++) {
            let index = i * gridsize + j;
            let cell = grid.children[index];
            if (cell.classList.contains("circle")) {
              sum += parseInt(cell.textContent);
            }
          }
          let index = numbersize * gridsize + j;
          let cell = grid.children[index];
          cell.textContent = sum;
          cell.classList.add("vanswer");
        }

        // Calculate corner sum
        let sum = 0;
        for (let j = 0; j <= numbersize - 1; j++) {
          let index = j * gridsize + j;
          let cell = grid.children[index];
          if (cell.classList.contains("circle")) {
            sum += parseInt(cell.textContent);
          }
        }
        let cornerIndex = numbersize * gridsize + numbersize;
        let cornerCell = grid.children[cornerIndex];
        cornerCell.textContent = sum;
        cornerCell.classList.add("canswer");

        // Remove circles from visual display
        Array.from(grid.children).forEach((cell) =>
          cell.classList.remove("circle")
        );

        // Add circles back to corner cells
        for (let i = 0; i < corners.length; i++) {
          const [row, col] = corners[i];
          const cellIndex = row * gridsize + col;
          grid.children[cellIndex].classList.add("circle");
        }

        // Set cell sizes
        const cellWidth = "calc(100% / " + gridsize + ")";
        Array.from(grid.children).forEach((cell) => {
          cell.style.width = cellWidth;
          cell.style.height = cellWidth;
        });

        // Add grid line styles
        const style1 = document.createElement("style");
        style1.type = "text/css";
        style1.innerHTML = `.number:nth-child(${gridsize}n+1) { border-left: 2px solid rgba(44,26,14,0.25); }`;
        document.getElementById("grid").appendChild(style1);

        const style2 = document.createElement("style");
        style2.type = "text/css";
        style2.innerHTML = `.number:nth-child(-n+${gridsize}) { border-top: 2px solid rgba(44,26,14,0.25); }`;
        document.getElementById("grid").appendChild(style2);

        check();
      }

      // Check rows and columns
      function check() {
        const grid = document.getElementById("grid");

        // Check rows
        for (let i = 0; i < gridsize - 1; i++) {
          let sum = 0;
          for (let j = 0; j < gridsize - 1; j++) {
            let index = i * gridsize + j;
            let cell = grid.children[index];
            if (!cell.classList.contains("delete")) {
              sum += parseInt(cell.textContent);
            }
          }
          let index = i * gridsize + (gridsize - 1);
          let cell = grid.children[index];
          if (sum == parseInt(cell.textContent)) {
            cell.classList.add("correct");
          } else {
            cell.classList.remove("correct");
          }
        }

        // Check columns
        for (let j = 0; j < gridsize - 1; j++) {
          let sum = 0;
          for (let i = 0; i < gridsize - 1; i++) {
            let index = i * gridsize + j;
            let cell = grid.children[index];
            if (!cell.classList.contains("delete")) {
              sum += parseInt(cell.textContent);
            }
          }
          let index = numbersize * gridsize + j;
          let cell = grid.children[index];
          if (sum == parseInt(cell.textContent)) {
            cell.classList.add("correct");
          } else {
            cell.classList.remove("correct");
          }
        }

        // Check corner
        let sum = 0;
        for (let j = 0; j <= numbersize - 1; j++) {
          let index = j * gridsize + j;
          let cell = grid.children[index];
          if (!cell.classList.contains("delete")) {
            sum += parseInt(cell.textContent);
          }
        }
        let cornerIndex = numbersize * gridsize + numbersize;
        let cornerCell = grid.children[cornerIndex];
        if (sum == parseInt(cornerCell.textContent)) {
          cornerCell.classList.add("correct");
        } else {
          cornerCell.classList.remove("correct");
        }

        // Check if puzzle complete
        const correctCells = document.querySelectorAll(".correct");
        if (correctCells.length == numbersize * 2 + 1) {
          Array.from(document.querySelectorAll(".number:not(.delete)")).forEach(
            (cell) => cell.classList.add("circle")
          );
          document.querySelector(".complete").classList.remove("hidden");
          document.querySelector(".new").classList.remove("hidden");
          document.querySelector(".controls").classList.add("hidden");
        }

        localStorage.setItem("loadgame", loadGame.innerHTML);
      }

      // Number clicks
      const grid = document.getElementById("grid");
      grid.addEventListener("click", function (e) {
        const target = e.target;
        if (!target.classList.contains("number")) {
          return;
        }

        if (
          !document.querySelector(".complete").classList.contains("hidden") ||
          !document.querySelector(".revealed").classList.contains("hidden")
        ) {
          return;
        }

        if (target.classList.contains("hint")) {
          return;
        }

        // Set state of cell
        if (target.classList.contains("mistake")) {
          target.classList.remove("circle", "delete", "mistake");
        } else if (target.classList.contains("delete")) {
          target.classList.remove("delete");
          target.classList.add("circle");
        } else if (target.classList.contains("circle")) {
          target.classList.remove("circle");
        } else {
          target.classList.add("delete");
        }

        // Hide remove if no more mistakes
        const mistakes = document.querySelectorAll(".mistake");
        if (mistakes.length == 0) {
          document.getElementById("remove").classList.add("hidden");
        }

        check();
      });

      // Show mistakes
      document.getElementById("mistakes").addEventListener("click", function () {
        const grid = document.getElementById("grid");
        Array.from(grid.querySelectorAll(".solution.delete")).forEach(
          (cell) => cell.classList.add("mistake")
        );
        Array.from(grid.querySelectorAll(".circle:not(.solution)")).forEach(
          (cell) => cell.classList.add("mistake")
        );
        if (grid.querySelectorAll(".mistake").length > 0) {
          document.getElementById("remove").classList.remove("hidden");
        }
        localStorage.setItem("loadgame", loadGame.innerHTML);
      });

      // Show hint
      document.getElementById("hint").addEventListener("click", function () {
        const grid = document.getElementById("grid");
        const availableCells = Array.from(
          grid.querySelectorAll(
            ".number:not(.solution):not(.hint):not(.delete)"
          )
        );
        if (availableCells.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableCells.length);
          availableCells[randomIndex].classList.add("hint", "delete");
          check();
        }
      });

      // Remove mistakes
      document.getElementById("remove").addEventListener("click", function () {
        const grid = document.getElementById("grid");
        Array.from(grid.querySelectorAll(".mistake")).forEach((cell) =>
          cell.classList.remove("mistake", "circle", "delete")
        );
        document.getElementById("remove").classList.add("hidden");
        check();
      });

      // Reveal solution
      document.getElementById("reveal").addEventListener("click", function () {
        if (
          confirm("Вы уверены, что хотите показать решение этой головоломки?")
        ) {
          const grid = document.getElementById("grid");
          Array.from(grid.querySelectorAll(".number")).forEach((cell) =>
            cell.classList.remove("circle", "delete", "mistake", "hint")
          );
          Array.from(grid.querySelectorAll(".solution")).forEach((cell) =>
            cell.classList.add("circle")
          );
          Array.from(grid.querySelectorAll(".number:not(.solution)")).forEach(
            (cell) => cell.classList.add("delete")
          );
          document.querySelectorAll(".hanswer").forEach((cell) => cell.classList.add("correct"));
          document.querySelectorAll(".vanswer").forEach((cell) => cell.classList.add("correct"));
          document.querySelector(".revealed").classList.remove("hidden");
          document.querySelector(".new").classList.remove("hidden");
          document.querySelector(".controls").classList.add("hidden");
          localStorage.setItem("loadgame", loadGame.innerHTML);
        }
      });

      // Restart puzzle
      document.getElementById("restart").addEventListener("click", function () {
        if (confirm("Вы уверены, что хотите начать эту головоломку заново?")) {
          const grid = document.getElementById("grid");
          Array.from(grid.children).forEach((cell) =>
            cell.classList.remove("hint", "correct", "circle", "delete", "mistake")
          );
          // Restore initial circles on corner cells
          const corners = [
            [1, 1],
            [1, gridsize - 3],
            [gridsize - 3, 1],
            [gridsize - 3, gridsize - 3],
          ];
          for (let i = 0; i < corners.length; i++) {
            const [row, col] = corners[i];
            const cellIndex = row * gridsize + col;
            grid.children[cellIndex].classList.add("circle");
          }
          document.querySelector(".complete").classList.add("hidden");
          document.querySelector(".revealed").classList.add("hidden");
          document.querySelector(".new").classList.add("hidden");
          document.querySelector(".controls").classList.remove("hidden");
          check();
        }
      });

      // New puzzle
      document.getElementById("new").addEventListener("click", function () {
        localStorage.removeItem("loadgame");
        const grid = document.getElementById("grid");
        grid.innerHTML = "";
        // Remove old style elements
        const oldStyles = grid.querySelectorAll("style");
        oldStyles.forEach(style => style.remove());
        document.querySelector(".complete").classList.add("hidden");
        document.querySelector(".revealed").classList.add("hidden");
        document.querySelector(".new").classList.add("hidden");
        document.querySelector(".controls").classList.remove("hidden");
        gridsize = parseInt(document.getElementById("size").value) + 1;
        numbersize = gridsize - 1;
        generate();
      });

      // Prevent double click zoom
      document.addEventListener("dblclick", function (e) {
        e.preventDefault();
      }, { passive: false });
