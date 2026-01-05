// Vietnamese Medicinal Plant Species Database - Main Application

class SpeciesDatabase {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.pageSize = 50;
        this.sortColumn = 'canonicalName';
        this.sortDirection = 'asc';

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadDefaultData();
    }

    bindEvents() {
        // Search input
        document.getElementById('search').addEventListener('input',
            this.debounce(() => this.applyFilters(), 300));

        // Filter dropdowns
        document.getElementById('familyFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('classFilter').addEventListener('change', () => this.applyFilters());

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));
        document.getElementById('pageSize').addEventListener('change', (e) => {
            this.pageSize = e.target.value === 'all' ? Infinity : parseInt(e.target.value);
            this.currentPage = 1;
            this.renderTable();
        });

        // File upload
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));

        // Table sorting
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.sortBy(th.dataset.sort));
        });

        // Modal
        document.querySelector('.close-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.closeModal();
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    async loadDefaultData() {
        try {
            const response = await fetch('viet_medi_species_2026_metadata.csv');
            if (!response.ok) throw new Error('Failed to load CSV');
            const csvText = await response.text();
            this.data = this.parseCSV(csvText);
            this.applyFilters();
            this.populateFilterDropdowns();
        } catch (error) {
            console.error('Error loading default data:', error);
            document.getElementById('tableBody').innerHTML =
                '<tr><td colspan="6" class="loading">Error loading data. Please try uploading a file.</td></tr>';
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }

        return data;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        return values;
    }

    parseJSON(jsonText) {
        const parsed = JSON.parse(jsonText);
        return Array.isArray(parsed) ? parsed : [parsed];
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target.result;

                if (file.name.endsWith('.json')) {
                    this.data = this.parseJSON(content);
                } else if (file.name.endsWith('.csv')) {
                    this.data = this.parseCSV(content);
                } else {
                    alert('Please upload a CSV or JSON file.');
                    return;
                }

                document.querySelector('.data-source p').innerHTML =
                    `Data source: <code>${file.name}</code> (${this.data.length} records)`;

                this.applyFilters();
                this.populateFilterDropdowns();
            } catch (error) {
                console.error('Error parsing file:', error);
                alert('Error parsing file. Please check the format.');
            }
        };
        reader.readAsText(file);
    }

    populateFilterDropdowns() {
        // Get unique families
        const families = [...new Set(this.data.map(d => d.family).filter(Boolean))].sort();
        const familySelect = document.getElementById('familyFilter');
        familySelect.innerHTML = '<option value="">All Families</option>';
        families.forEach(family => {
            familySelect.innerHTML += `<option value="${family}">${family}</option>`;
        });

        // Get unique classes
        const classes = [...new Set(this.data.map(d => d.class).filter(Boolean))].sort();
        const classSelect = document.getElementById('classFilter');
        classSelect.innerHTML = '<option value="">All Classes</option>';
        classes.forEach(cls => {
            classSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
        });
    }

    applyFilters() {
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const familyFilter = document.getElementById('familyFilter').value;
        const classFilter = document.getElementById('classFilter').value;

        this.filteredData = this.data.filter(item => {
            // Search filter
            const matchesSearch = !searchTerm ||
                (item.canonicalName && item.canonicalName.toLowerCase().includes(searchTerm)) ||
                (item.scientificName && item.scientificName.toLowerCase().includes(searchTerm)) ||
                (item.vietnameseName && item.vietnameseName.toLowerCase().includes(searchTerm)) ||
                (item.vernacularName && item.vernacularName.toLowerCase().includes(searchTerm)) ||
                (item.family && item.family.toLowerCase().includes(searchTerm)) ||
                (item.genus && item.genus.toLowerCase().includes(searchTerm));

            // Family filter
            const matchesFamily = !familyFilter || item.family === familyFilter;

            // Class filter
            const matchesClass = !classFilter || item.class === classFilter;

            return matchesSearch && matchesFamily && matchesClass;
        });

        this.sortData();
        this.currentPage = 1;
        this.renderTable();
    }

    sortBy(column) {
        // Update sort direction
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Update header styles
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === column) {
                th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });

        this.sortData();
        this.renderTable();
    }

    sortData() {
        this.filteredData.sort((a, b) => {
            const valA = (a[this.sortColumn] || '').toLowerCase();
            const valB = (b[this.sortColumn] || '').toLowerCase();

            if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    changePage(delta) {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        this.currentPage = Math.max(1, Math.min(totalPages, this.currentPage + delta));
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        const totalItems = this.filteredData.length;
        const totalPages = Math.ceil(totalItems / this.pageSize) || 1;

        // Update result count
        document.getElementById('resultCount').textContent =
            `Showing ${totalItems} species`;

        // Calculate pagination
        const start = (this.currentPage - 1) * this.pageSize;
        const end = Math.min(start + this.pageSize, totalItems);
        const pageData = this.filteredData.slice(start, end);

        // Update pagination controls
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
        document.getElementById('pageInfo').textContent =
            `Page ${this.currentPage} of ${totalPages}`;

        // Render rows
        if (pageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No results found</td></tr>';
            return;
        }

        tbody.innerHTML = pageData.map((item, index) => `
            <tr data-index="${start + index}">
                <td><em>${this.escapeHtml(item.canonicalName || '-')}</em></td>
                <td>${this.escapeHtml(item.vietnameseName || '-')}</td>
                <td>${this.escapeHtml(item.family || '-')}</td>
                <td>${this.escapeHtml(item.genus || '-')}</td>
                <td>${this.escapeHtml(item.class || '-')}</td>
                <td>${this.escapeHtml(item.vernacularName || '-')}</td>
            </tr>
        `).join('');

        // Add click handlers for row details
        tbody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', () => {
                const index = parseInt(row.dataset.index);
                this.showDetails(this.filteredData[index]);
            });
        });
    }

    showDetails(item) {
        document.getElementById('modalTitle').textContent = item.canonicalName || 'Species Details';

        const detailFields = [
            { label: 'Scientific Name', key: 'scientificName' },
            { label: 'Vietnamese Name', key: 'vietnameseName' },
            { label: 'Common Name', key: 'vernacularName' },
            { label: 'Family', key: 'family' },
            { label: 'Genus', key: 'genus' },
            { label: 'Class', key: 'class' },
            { label: 'Order', key: 'order' },
            { label: 'Phylum', key: 'phylum' },
            { label: 'Kingdom', key: 'kingdom' },
            { label: 'Authorship', key: 'authorship' },
            { label: 'Published In', key: 'publishedIn' },
            { label: 'Taxonomic Status', key: 'taxonomicStatus' },
            { label: 'Rank', key: 'rank' }
        ];

        let html = '';
        detailFields.forEach(field => {
            const value = item[field.key];
            if (value) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">${field.label}:</span>
                        <span class="detail-value">${this.escapeHtml(value)}</span>
                    </div>
                `;
            }
        });

        document.getElementById('modalBody').innerHTML = html;
        document.getElementById('modal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new SpeciesDatabase();
});
