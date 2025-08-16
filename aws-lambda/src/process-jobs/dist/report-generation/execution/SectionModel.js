"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionModel = void 0;
class SectionModel {
    constructor(sections = []) {
        this.state = { sections: sections.filter(s => s) }; // Filter out null/undefined sections
    }
    getState() {
        return this.state;
    }
    static fromJSON(json) {
        return new SectionModel(json.sections);
    }
    toJSON() {
        return this.state;
    }
    autoNumberSections() {
        let counters = [0, 0, 0, 0, 0];
        const numberSection = (section, level) => {
            if (!section)
                return;
            counters[level]++;
            for (let i = level + 1; i < counters.length; i++) {
                counters[i] = 0;
            }
            section.number = counters.slice(0, level + 1).join('.');
            if (section.children) {
                section.children.forEach(child => numberSection(child, level + 1));
            }
        };
        this.state.sections.forEach(section => numberSection(section, 0));
    }
}
exports.SectionModel = SectionModel;
//# sourceMappingURL=SectionModel.js.map