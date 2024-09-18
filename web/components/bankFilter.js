// bank filter for ag grid, show list of checkbox - like set filter

const ListBanks = ["VCB", "BIDV", "Agri", "Vietin"];

export class BankFilter {
  eGui;
  banks = new Map();

  init(params) {
    this.eGui = document.createElement("div");
    this.eGui.innerHTML =
      `<div class="bank-filter-container">
        <p>Chọn ngân hàng:</p>
      ` +
      ListBanks.map((bank) => {
        return `<label class="bank-filter-item">
            <input type="checkbox" value="${bank}"/>
            ${bank}
        </label>`;
      }).join("") +
      "</div>";

    const inputs = this.eGui.querySelectorAll("input");
    inputs.forEach((input) => {
      input.addEventListener("change", (e) => {
        this.banks.set(e.target.value, e.target.checked);
        params.filterChangedCallback();
      });
    });
  }

  getGui() {
    return this.eGui;
  }

  onNewRowsLoaded() {
    console.log("onNewRowsLoaded", arguments);
  }

  doesFilterPass(params) {
    return this.banks.get(params.data.bank) === true;
  }

  isFilterActive() {
    return this.banks.values().some((value) => value === true);
  }
}
