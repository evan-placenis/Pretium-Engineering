import { v4 as uuidv4 } from 'uuid';
import { Section } from '../../types';

export class SectionModel {
    private state: { sections: Section[] };

    constructor(sections: Section[] = []) {
        this.state = { sections: sections.filter(s => s) }; // Filter out null/undefined sections
    }

    getState() {
        return this.state;
    }

    static fromJSON(json: { sections: Section[] }): SectionModel {
        return new SectionModel(json.sections);
    }

    toJSON() {
        return this.state;
    }

    autoNumberSections() {
        let counters = [0, 0, 0, 0, 0];
        const numberSection = (section: Section, level: number) => {
            if (!section) return;
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
