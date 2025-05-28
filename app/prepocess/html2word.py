from docx.document import Document
from docx.table import Table
from bs4 import BeautifulSoup

def html_table_to_word(html_content: str, doc: Document) -> Table | None:
    """
    将包含表格的 HTML 字符串转换为 Word 文档中的表格。
    支持单元格合并 (colspan 和 rowspan)。

    :param html_content: 包含 HTML 表格的字符串。
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    html_table_tag = soup.find('table')

    if not html_table_tag:
        print("在 HTML 内容中未找到 <table> 标签。")
        return None

    html_rows = html_table_tag.find_all('tr')  # type: ignore
    if not html_rows:
        print("在表格中未找到 <tr> 标签。")
        return None

    # --- 阶段 1: 使用概念性网格确定真实的表格维度 ---
    # conceptual_grid_map 用于标记单元格是否被占用，以计算维度
    # 列表的列表，内部列表代表行，值为 True 表示被占用
    conceptual_grid_map: list[list[bool | None]] = [] 
    
    # 表格所需的最大行数和列数
    max_effective_rows = 0
    max_effective_cols = 0

    for r_idx, html_row_element in enumerate(html_rows):
        current_col_cursor = 0  # 当前尝试放置单元格的列索引

        # 确保 conceptual_grid_map 至少有 r_idx 那么多行
        while r_idx >= len(conceptual_grid_map):
            # 新行需要和已存在的最宽行一样宽
            current_max_width = 0
            if conceptual_grid_map: # 如果不是添加的第一行
                current_max_width = max(len(row) for row in conceptual_grid_map if row) if any(conceptual_grid_map) else 0
            conceptual_grid_map.append([None] * current_max_width) # None 表示未被占用

        html_cell_elements = html_row_element.find_all(['th', 'td'])
        if not html_cell_elements and r_idx >= max_effective_rows : # 空行，但仍需记录行数
             max_effective_rows = max(max_effective_rows, r_idx + 1)
             continue


        for html_cell_element in html_cell_elements:
            colspan = int(html_cell_element.get('colspan', 1))
            rowspan = int(html_cell_element.get('rowspan', 1))

            # 确保 conceptual_grid_map[r_idx] 足够长以容纳 current_col_cursor
            while current_col_cursor >= len(conceptual_grid_map[r_idx]):
                conceptual_grid_map[r_idx].append(None)
            
            # 跳过已被上方 rowspan 占用的单元格
            while conceptual_grid_map[r_idx][current_col_cursor] is not None:
                current_col_cursor += 1
                # 再次确保 conceptual_grid_map[r_idx] 足够长
                while current_col_cursor >= len(conceptual_grid_map[r_idx]):
                    conceptual_grid_map[r_idx].append(None)
            
            # 在 conceptual_grid_map 中标记被占用的单元格
            for i_offset in range(rowspan):
                target_row_idx = r_idx + i_offset
                
                # 确保 conceptual_grid_map 至少有 target_row_idx 那么多行
                while target_row_idx >= len(conceptual_grid_map):
                    current_max_width = max(len(row) for row in conceptual_grid_map if row) if any(conceptual_grid_map) else 0
                    conceptual_grid_map.append([None] * current_max_width)

                for j_offset in range(colspan):
                    target_col_idx = current_col_cursor + j_offset
                    # 确保 conceptual_grid_map[target_row_idx] 足够长
                    while target_col_idx >= len(conceptual_grid_map[target_row_idx]):
                        conceptual_grid_map[target_row_idx].append(None)
                    
                    conceptual_grid_map[target_row_idx][target_col_idx] = True # 标记为占用

            # 更新追踪的整体维度
            max_effective_rows = max(max_effective_rows, r_idx + rowspan)
            max_effective_cols = max(max_effective_cols, current_col_cursor + colspan)
            
            current_col_cursor += colspan # 为此 HTML 行中的下一个单元格移动光标
    
    # 如果在循环后 max_effective_cols 仍然为 0 (例如，所有行都是空的 <tr></tr>)
    # 如果 conceptual_grid_map 本身因初始化而具有列，则可能需要调整它
    if max_effective_cols == 0 and conceptual_grid_map:
        max_effective_cols = max(len(r) for r in conceptual_grid_map if r) if any(conceptual_grid_map) else 0
    
    # 如果在处理完所有行后，max_effective_rows 仍为 0 (例如，空的 <table></table>)
    # 但 html_rows 本身有内容 (尽管可能是空的tr)，则使用 html_rows 的长度
    if max_effective_rows == 0 and len(html_rows) > 0:
        max_effective_rows = len(html_rows)


    # Word 表格的最终维度
    final_num_rows = max_effective_rows
    final_num_cols = max_effective_cols

    if final_num_rows == 0 or final_num_cols == 0:
        print("HTML 表格为空或其结构无法确定。")
        return None

    word_table = doc.add_table(rows=final_num_rows, cols=final_num_cols)
    # 应用一个带边框的常用样式
    try:
        word_table.style = 'Table Grid'
    except KeyError:
        pass

    # --- 阶段 2: 使用确定的维度填充 Word 表格 ---
    # 使用 final_num_rows 和 final_num_cols 初始化 shadow_grid
    # True 表示单元格已被覆盖，或者是已处理的合并区域的开始
    fill_shadow_grid = [[False for _ in range(final_num_cols)] for _ in range(final_num_rows)]

    for r_idx, html_row_element in enumerate(html_rows):
        html_cell_elements = html_row_element.find_all(['th', 'td'])
        current_word_table_col_idx = 0 # Word 表格中的列索引

        for html_cell_element in html_cell_elements:
            # 在当前行的 shadow_grid 中找到下一个可用单元格
            while current_word_table_col_idx < final_num_cols and \
                  fill_shadow_grid[r_idx][current_word_table_col_idx]:
                current_word_table_col_idx += 1
            
            if current_word_table_col_idx >= final_num_cols:
                # 如果 HTML 结构比预期的更复杂，可能会发生这种情况
                print(f"警告: 第 {r_idx} 行的单元格内容超出了计算的最大列数 {final_num_cols}。跳过此单元格。")
                continue

            # BeautifulSoup 的 get_text 通过 separator='\n' 将 <br/> 转换成换行符
            text = html_cell_element.get_text(separator='\n', strip=True)
            colspan = int(html_cell_element.get('colspan', 1))
            rowspan = int(html_cell_element.get('rowspan', 1))

            # 确保 rowspan 和 colspan 不会超出表格边界
            # (r_idx + rowspan) 不能超过 final_num_rows
            # (current_word_table_col_idx + colspan) 不能超过 final_num_cols
            actual_rowspan = min(rowspan, final_num_rows - r_idx)
            actual_colspan = min(colspan, final_num_cols - current_word_table_col_idx)
            
            if actual_rowspan < 1 or actual_colspan < 1:
                print(f"警告: HTML 行 {r_idx}, 列 {current_word_table_col_idx} 处的单元格在边界检查后尺寸为零。跳过。")
                current_word_table_col_idx += actual_colspan if actual_colspan > 0 else 1 
                continue
            
            # 将文本放入合并块的左上角单元格
            # (r_idx, current_word_table_col_idx) 是此块的起始单元格
            doc_cell = word_table.cell(r_idx, current_word_table_col_idx)
            doc_cell.text = text 

            # 在 shadow_grid 中标记单元格为 True (已覆盖)
            for i in range(r_idx, r_idx + actual_rowspan):
                for j in range(current_word_table_col_idx, current_word_table_col_idx + actual_colspan):
                    if i < final_num_rows and j < final_num_cols:
                        fill_shadow_grid[i][j] = True
                    else:
                        # 这意味着 rowspan/colspan 超出了表格范围 (理论上被 actual_rowspan/colspan 捕获)
                        print(f"警告: 尝试在 ({i},{j}) 处标记 shadow_grid 超出边界")
            
            # 如果 rowspan > 1 或 colspan > 1，则在 Word 表格中执行合并
            if actual_rowspan > 1 or actual_colspan > 1:
                # 合并的右下角单元格
                br_r_idx = r_idx + actual_rowspan - 1
                br_c_idx = current_word_table_col_idx + actual_colspan - 1
                
                # 再次确保右下角在表格边界内 (如果 actual_ 值正确，则多余)
                # br_r_idx = min(br_r_idx, final_num_rows - 1)
                # br_c_idx = min(br_c_idx, final_num_cols - 1)

                if br_r_idx >= r_idx and br_c_idx >= current_word_table_col_idx : # 有效的合并区域
                    end_cell = word_table.cell(br_r_idx, br_c_idx)
                    doc_cell.merge(end_cell)
                else:
                     print(f"警告: 单元格 ({r_idx},{current_word_table_col_idx}) 的合并尺寸无效。实际行跨度:{actual_rowspan}, 实际列跨度:{actual_colspan}")

            # 为当前 HTML 行中的下一个 HTML 单元格推进 current_word_table_col_idx
            current_word_table_col_idx += actual_colspan
    return word_table

if __name__ == '__main__':
    from docx import Document  # type: ignore

    doc = Document() # type: ignore
    html_example = """
    <table border="1">
      <tr>
        <th>序号</th>
        <th>名称</th>
        <th>品牌</th>
        <th>型号<br/>规格</th>
        <th>数量</th>
        <th>原产地</th>
        <th>制造商名称</th>
        <th>单价</th>
        <th>价格</th>
        <th>备注</th>
      </tr>
      <tr>
        <td>1</td>
        <td>智能门锁 (指纹锁)</td>
        <td>艾栖</td>
        <td>DL600</td>
        <td>1</td>
        <td>上海</td>
        <td>套</td>
        <td>**</td>
        <td>**</td>
        <td></td>
      </tr>
      <tr>
        <td>2</td>
        <td>智能门锁 (宾馆锁)</td>
        <td>得安</td>
        <td>TAS-T 系列</td>
        <td>2</td>
        <td>深圳</td>
        <td>套</td>
        <td>**</td>
        <td>**</td>
        <td></td>
      </tr>
      <tr>
        <td>3</td>
        <td>金属按钮</td>
        <td>COUNS</td>
        <td>86</td>
        <td>30</td>
        <td>深圳</td>
        <td>个</td>
        <td>**</td>
        <td>**</td>
        <td></td>
      </tr>
      <tr>
        <td colspan="8">总价</td>
        <td>**</td>
        <td></td>
      </tr>
    </table>
    """
    html_table_to_word(html_example, doc)

    html_complex_example = """
    <table border="1">
        <tr>
            <td rowspan="2" colspan="2">A1-B2 (合并)</td>
            <td>C1</td>
            <td rowspan="3">D1-D3 (合并)</td>
        </tr>
        <tr>
            <td>C2</td>
        </tr>
        <tr>
            <td>A3</td>
            <td>B3</td>
            <td>C3</td>
        </tr>
        <tr>
            <td colspan="4">E4 (跨全列)</td>
        </tr>
    </table>
    """
    html_table_to_word(html_complex_example, doc)
    
    html_empty_row_example = """
    <table border="1">
      <tr><th>Header 1</th><th>Header 2</th></tr>
      <tr><td>Data 1.1</td><td>Data 1.2</td></tr>
      <tr></tr>
      <tr><td>Data 3.1</td><td>Data 3.2</td></tr>
    </table>
    """
    html_table_to_word(html_empty_row_example, doc)

    html_no_cells_table = """
    <table border="1">
      <tr></tr>
      <tr></tr>
    </table>
    """
    html_table_to_word(html_no_cells_table, doc)

    html_single_cell_span_table = """
    <table border="1">
      <tr><td rowspan="2" colspan="2">Big Cell</td></tr>
      <tr></tr>
    </table>
    """
    # Expected: 2 rows, 2 columns, first cell spans all.
    html_table_to_word(html_single_cell_span_table, doc)
    doc.save("examples.docx")
