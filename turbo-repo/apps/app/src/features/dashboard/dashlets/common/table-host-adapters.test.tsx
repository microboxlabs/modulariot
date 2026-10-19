// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {tableRowActions} from './table-host-adapters';
afterEach(cleanup);
it('filters unsafe resolved links while keeping safe row-dependent actions',()=>{
 const renderer=tableRowActions({enabled:true,items:[{name:'Safe',link:'https://example.com/{{id}}',target:'_blank'},{name:'Unsafe',link:'{{unsafe}}',target:'_self'}]},'Actions');
 render(<>{renderer?.({id:'billing',unsafe:'javascript:alert(1)'})}</>);
 fireEvent.click(screen.getByRole('button',{name:'Actions'}));
 expect(screen.getByRole('link',{name:'Safe'}).getAttribute('href')).toBe('https://example.com/billing');
 expect(screen.queryByRole('link',{name:'Unsafe'})).toBeNull();
 expect(tableRowActions({enabled:false,items:[]},'Actions')).toBeUndefined();
});
